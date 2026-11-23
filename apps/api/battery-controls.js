import {once} from './schema.js';
import {batteryEventsSchema} from './battery-history.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export const batteryIntervals=[30,60,120];
export function batteryEnabled(env,identifier){return (env.PEJLO_BATTERY_DEVICES||'').split(',').map(s=>s.trim()).includes(identifier);}
export function intervalCommand(identifier,seconds,serial=0){
 if(!/^\d{12}$/.test(identifier)||!batteryIntervals.includes(seconds))throw Error('Ugyldig tracker eller interval.');
 const hex='81030009'+identifier+(serial&65535).toString(16).padStart(4,'0')+'010000f1150300'+seconds.toString(16).padStart(4,'0');
 const bytes=hex.match(/../g).map(v=>parseInt(v,16));bytes.push(bytes.reduce((a,b)=>a^b,0));
 return '7e'+bytes.map(v=>v===126?'7d02':v===125?'7d01':v.toString(16).padStart(2,'0')).join('')+'7e';
}
export async function batteryControls({env,identifier,device,input,traccar,traccarFetch,now=Date.now()}){
 const enabled=batteryEnabled(env,identifier);
 if(!enabled){if(input)fail(409,'Batteristyring er ikke aktiveret for denne tracker.');return {enabled:false};}
 const db=env.DB;
 const storageId=(env.TRACCAR_SOURCE||'environment')+':'+identifier;
 await once(db,'batteryControls',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_battery_controls(identifier TEXT PRIMARY KEY,seconds INTEGER,status TEXT,requested_at INTEGER NOT NULL)').run());
 if(!input)return {enabled:true,last:await db.prepare('SELECT seconds,status,requested_at FROM pejlo_battery_controls WHERE identifier=?').bind(storageId).first()};
 const seconds=input.seconds;
 if(!batteryIntervals.includes(seconds))fail(400,'Vælg 30, 60 eller 120 sekunder.');
 if(seconds===120&&input.testConfirmed!==true)fail(400,'Bekræft afprøvning af 120 sekunder.');
 if(device.status!=='online')fail(409,'Trackeren er offline. Prøv igen, når den er online.');
 // Some JT808 models reinterpret custom data as text, so enable only the validated model family.
 const model=device.model||device.attributes?.model;
 if(model&&/^(AL300|GL100|VL300|BSJ|C5|C5L|JC)/.test(model))fail(409,'Denne trackermodel understøttes ikke af intervalstyringen.');
 const types=await traccar('/api/commands/types?'+new URLSearchParams({deviceId:String(device.id),textChannel:'false'}));
 if(!Array.isArray(types)||!types.some(t=>t.type==='custom'))fail(409,'Trackeren tilbyder ikke intervalkommandoen.');
 const reserved=await db.prepare(`INSERT INTO pejlo_battery_controls(identifier,seconds,status,requested_at) VALUES(?,?,'pending',?)
 ON CONFLICT(identifier) DO UPDATE SET seconds=excluded.seconds,status='pending',requested_at=excluded.requested_at
 WHERE pejlo_battery_controls.requested_at<=? RETURNING identifier`).bind(storageId,seconds,now,now-60000).first();
 if(!reserved)fail(429,'Vent et minut mellem intervalændringer.');
 await batteryEventsSchema(db);
 await db.prepare('INSERT INTO pejlo_battery_events(identifier,at,seconds,status) VALUES(?,?,?,?)').bind(storageId,now,seconds,'pending').run();
 let status='uncertain';
 try{
  const response=await traccarFetch('/api/commands/send',{method:'POST',body:JSON.stringify({deviceId:device.id,type:'custom',textChannel:false,attributes:{data:intervalCommand(identifier,seconds,now),noQueue:true}})});
  status=response.ok&&response.status!==202?'sent':[400,401,403,404,422].includes(response.status)?'rejected':'uncertain';
 }finally{
  await db.prepare('UPDATE pejlo_battery_controls SET status=? WHERE identifier=? AND requested_at=?').bind(status,storageId,now).run();
  await db.prepare('UPDATE pejlo_battery_events SET status=? WHERE identifier=? AND at=?').bind(status,storageId,now).run();
 }
 if(status!=='sent')fail(502,'Afsendelsen kunne ikke bekræftes. Kontrollér trackerens indstillinger før et nyt forsøg.');
 return {enabled:true,last:{seconds,status,requested_at:now}};
}
