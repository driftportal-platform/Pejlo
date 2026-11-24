import {once} from './schema.js';
import {batteryControls,batteryEnabled,batteryIntervals} from './battery-controls.js';
import {trackerTelemetry} from './gps.js';
import {cleanWifiConfig,homeWifiStatus} from '../../packages/shared/home-wifi.js';
import {nextBatteryTarget} from '../../packages/shared/battery-policy.js';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const source=env=>env.TRACCAR_SOURCE||'environment';
export function ensureBatteryPolicy(db){return once(db,'batteryPolicy',()=>db.prepare(`CREATE TABLE IF NOT EXISTS pejlo_battery_policy(
 source TEXT NOT NULL,identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,
 auto_enabled INTEGER NOT NULL DEFAULT 0,find_until INTEGER NOT NULL DEFAULT 0,
 resume_seconds INTEGER NOT NULL DEFAULT 60,restore_pending INTEGER NOT NULL DEFAULT 0,
 inside_count INTEGER NOT NULL DEFAULT 0,inside_since INTEGER NOT NULL DEFAULT 0,sample_at INTEGER NOT NULL DEFAULT 0,
 checked_at INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(source,identifier,owner_uid))`).run());}
async function readPolicy(db,env,identifier,uid){
 return db.prepare('SELECT * FROM pejlo_battery_policy WHERE source=? AND identifier=? AND owner_uid=?').bind(source(env),identifier,uid).first();
}
async function lock(db,env,identifier,uid,now){
 await ensureBatteryPolicy(db);
 await db.prepare('INSERT OR IGNORE INTO pejlo_battery_policy(source,identifier,owner_uid) VALUES(?,?,?)').bind(source(env),identifier,uid).run();
 return db.prepare('UPDATE pejlo_battery_policy SET lease_until=?,checked_at=? WHERE source=? AND identifier=? AND owner_uid=? AND lease_until<=? RETURNING *').bind(now+120000,now,source(env),identifier,uid,now).first();
}
async function save(db,env,row){
 await db.prepare(`UPDATE pejlo_battery_policy SET auto_enabled=?,find_until=?,resume_seconds=?,restore_pending=?,inside_count=?,inside_since=?,sample_at=?,note=?
 WHERE source=? AND identifier=? AND owner_uid=? AND lease_until=?`).bind(row.auto_enabled,row.find_until,row.resume_seconds,row.restore_pending,row.inside_count,row.inside_since,row.sample_at,row.note,source(env),row.identifier,row.owner_uid,row.lease_until).run();
}
async function unlock(db,env,row){
 await db.prepare('UPDATE pejlo_battery_policy SET lease_until=0 WHERE source=? AND identifier=? AND owner_uid=? AND lease_until=?').bind(source(env),row.identifier,row.owner_uid,row.lease_until).run();
}
async function profileWifi(db,identifier,uid){
 const row=await db.prepare('SELECT profile FROM pejlo_profiles WHERE identifier=? AND owner_uid=?').bind(identifier,uid).first();
 let profile={};try{profile=JSON.parse(row?.profile||'{}');}catch{}
 return cleanWifiConfig(profile?.homeWifi);
}
async function ownerStillCurrent(db,row){return !!await db.prepare('SELECT identifier FROM trackers WHERE identifier=? AND owner_uid=?').bind(row.identifier,row.owner_uid).first();}
async function evaluate(options,row){
 const {env,identifier,device,traccar,now}=options;
 const last=(await batteryControls({...options,input:null})).last;
 if(device.status!=='online'){row.note='offline';await save(env.DB,env,row);return;}
 let observation=null;
 if(row.auto_enabled&&row.find_until<=now){
  const wifi=await profileWifi(env.DB,identifier,row.owner_uid);
  let positions=[];
  try{positions=device.positionId?await traccar('/api/positions?id='+encodeURIComponent(device.positionId)):[];}catch{}
  // Unavailable signal data must not keep the slower home interval active.
  const raw=positions.find(p=>p.id===device.positionId&&p.deviceId===device.id);
  observation=homeWifiStatus({device,telemetry:trackerTelemetry(raw,now)},wifi,now);
 }
 const next=nextBatteryTarget(row,observation,now);Object.assign(row,next.state);
 row.note=next.reason;
 // The command log is the only send-state authority, including timeouts and crashes.
 if(last?.seconds===next.seconds){
  if(last.status==='sent'){row.restore_pending=0;if(row.find_until<=now)row.find_until=0;}
  else row.note='uncertain';
  await save(env.DB,env,row);return;
 }
 if(last&&now-last.requested_at<60000){row.note='cooldown';await save(env.DB,env,row);return;}
 if(!await ownerStillCurrent(env.DB,row))return;
 try{
  await batteryControls({...options,input:{seconds:next.seconds,testConfirmed:true}});
  row.restore_pending=0;if(row.find_until<=now)row.find_until=0;
 }catch(error){row.note=error.status===429?'cooldown':error.status===409?'unsupported':'uncertain';}
 await save(env.DB,env,row);
}
export async function managedBattery(options){
 const {env,identifier,uid,input,device,now=Date.now()}=options;options={...options,now};
 if(!batteryEnabled(env,identifier))return batteryControls(options);
 await ensureBatteryPolicy(env.DB);
 if(!input)return {...await batteryControls(options),policy:await readPolicy(env.DB,env,identifier,uid)};
 const action=input.action||'manual';
 if(!['manual','auto','find','stop'].includes(action))fail(400,'Vælg en batterifunktion.');
 if(action==='manual'&&!batteryIntervals.includes(input.seconds))fail(400,'Vælg 30, 60 eller 120 sekunder.');
 if(action==='find'&&![5,15].includes(input.minutes))fail(400,'Vælg Find i 5 eller 15 minutter.');
 if(action==='auto'&&typeof input.enabled!=='boolean')fail(400,'Vælg om automatik skal være aktiv.');
 if(action==='auto'&&input.enabled){
  if(input.testConfirmed!==true)fail(400,'Bekræft afprøvning af automatisk intervalskift.');
  const wifi=await profileWifi(env.DB,identifier,uid);
  if(wifi.samples.filter(s=>s.label==='inside').length<3||wifi.samples.filter(s=>s.label==='outside').length<3)fail(409,'Gem først mindst tre Wi-Fi-målinger inde og tre ude under Profil.');
 }
 if(action==='find'&&device.status!=='online')fail(409,'Trackeren skal være online for at starte Find.');
 const row=await lock(env.DB,env,identifier,uid,now);if(!row)fail(409,'Batteristyringen er optaget. Prøv igen om lidt.');
 try{
  if(!await ownerStillCurrent(env.DB,row))fail(403,'Trackerens ejer er ændret.');
  if(action==='manual'){
   // Offline, capability and cooldown failures must not cancel an existing Find expiry.
   let result,error;
   try{result=await batteryControls(options);}catch(e){error=e;}
   if(!result){
    if(error?.status&&error.status!==502)throw error;
    const last=(await batteryControls({...options,input:null})).last;
    if(last?.requested_at!==now)throw error;
   }
   // Once a send was attempted, manual intent supersedes automation even if its response was lost.
   row.auto_enabled=0;row.find_until=0;row.restore_pending=0;row.resume_seconds=input.seconds;row.note=error?'uncertain':'manual';
   row.inside_count=0;row.inside_since=0;row.sample_at=0;await save(env.DB,env,row);
   if(error)throw error;
   return {...result,policy:row};
  }
  if(action==='find'){
   if(row.find_until<=now){
    const last=(await batteryControls({...options,input:null})).last;
    row.resume_seconds=last?.status==='sent'&&batteryIntervals.includes(last.seconds)?last.seconds:60;
   }
   row.find_until=now+input.minutes*60000;row.restore_pending=1;
  }else if(action==='stop'){
   if(row.find_until>0){row.find_until=0;row.restore_pending=1;}
  }else{
   row.auto_enabled=input.enabled?1:0;row.find_until=0;row.restore_pending=1;row.resume_seconds=60;
   row.inside_count=0;row.inside_since=0;row.sample_at=0;
  }
  await save(env.DB,env,row);
  if(row.auto_enabled||row.find_until||row.restore_pending)await evaluate(options,row);
  return {...await batteryControls({...options,input:null}),policy:row};
 }finally{await unlock(env.DB,env,row);}
}
export async function runBatteryAutomation(env,fetcher=fetch,base,now=Date.now()){
 if(!env.DB||!env.TRACCAR_TOKEN||!base||!env.PEJLO_BATTERY_DEVICES)return;
 await ensureBatteryPolicy(env.DB);
 const rows=await env.DB.prepare(`SELECT p.identifier,p.owner_uid FROM pejlo_battery_policy p JOIN trackers t ON t.identifier=p.identifier AND t.owner_uid=p.owner_uid
 WHERE p.source=? AND (p.auto_enabled=1 OR p.find_until>0 OR p.restore_pending=1) AND p.lease_until<=?
 ORDER BY p.checked_at LIMIT 8`).bind(source(env),now).all();
 const traccarFetch=(path,options={})=>fetcher(base+path,{...options,headers:{Authorization:'Bearer '+env.TRACCAR_TOKEN,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},redirect:'manual',signal:AbortSignal.timeout(10000)});
 const traccar=async path=>{const r=await traccarFetch(path);if(!r.ok)throw Error('upstream');return r.json();};
 for(const candidate of rows.results){
  if(!batteryEnabled(env,candidate.identifier))continue;
  const row=await lock(env.DB,env,candidate.identifier,candidate.owner_uid,now);if(!row)continue;
  try{
   const devices=await traccar('/api/devices?uniqueId='+encodeURIComponent(row.identifier));
   const device=devices.find(d=>d.uniqueId===row.identifier&&Number.isSafeInteger(d.id));
   if(!device){row.note='missing';await save(env.DB,env,row);continue;}
   await evaluate({env,identifier:row.identifier,uid:row.owner_uid,device,traccar,traccarFetch,now},row);
  }catch{row.note='error';await save(env.DB,env,row);}
  finally{await unlock(env.DB,env,row);}
 }
}
