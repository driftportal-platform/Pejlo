import {once} from './schema.js';
import {resolveTraccarEnv} from './server-config.js';
import {traccarOrigin} from './traccar-url.js';
const kinds=new Set(['sleep_report','position_report','query_report','heartbeat']);
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const schema=db=>once(db,'report-state',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_report_state(identifier TEXT NOT NULL,source TEXT NOT NULL,kind TEXT NOT NULL,received_at INTEGER NOT NULL,battery INTEGER,charging INTEGER,PRIMARY KEY(identifier,source,kind))').run());
async function limitedBody(request){
 const reader=request.body?.getReader();if(!reader)return '';
 const parts=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>4096){await reader.cancel().catch(()=>{});fail(413,'For mange oplysninger.');}parts.push(value);}
 const bytes=new Uint8Array(length);let at=0;for(const part of parts){bytes.set(part,at);at+=part.byteLength;}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail(400,'Ugyldigt beskedformat.');}
}

// This endpoint accepts signed metadata from a read-only log reader, not commands.
export async function receiveReportState(request,env,now=Date.now()){
 if(request.method!=='POST')fail(405,'Metoden er ikke tilladt.');
 if(request.headers.get('Origin'))fail(403,'Adgang afvist.');
 if(Number(request.headers.get('content-length')||0)>4096)fail(413,'For mange oplysninger.');
 const raw=await limitedBody(request);
 let data,keys;try{data=JSON.parse(raw);keys=JSON.parse(env.PEJLO_STATUS_KEYS||'{}');}catch{fail(401,'Statusadgang afvist.');}
 const id=data?.identifier,key=Object.hasOwn(keys||{},id)?keys[id]:null,signature=request.headers.get('X-Pejlo-Signature')||'';
 if(typeof key!=='string'||!/^[0-9a-f]{64}$/.test(key)||!/^\d{12}(\d{8})?$/.test(id)||!/^[0-9a-f]{64}$/.test(signature))fail(401,'Statusadgang afvist.');
 const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',hmac,Uint8Array.from(signature.match(/../g),x=>parseInt(x,16)),new TextEncoder().encode(raw)))fail(401,'Statusadgang afvist.');
 if(!Number.isSafeInteger(data.sentAt)||Math.abs(data.sentAt-now)>300000)fail(400,'Statusbeskeden er udløbet.');
 if(!Array.isArray(data.events)||!data.events.length||data.events.length>4)fail(400,'Ugyldige statusmålinger.');
 // Validate the whole batch before writing any events.
 const events=data.events.map(e=>{
  if(!e||!kinds.has(e.kind)||!Number.isSafeInteger(e.receivedAt)||e.receivedAt>now+60000||e.receivedAt<now-86400000)fail(400,'Ugyldigt måletidspunkt.');
  const battery=e.battery??null,charging=e.charging??null;
  if(battery!==null&&(!Number.isInteger(battery)||battery<0||battery>100))fail(400,'Ugyldigt batteriniveau.');
  if(charging!==null&&typeof charging!=='boolean')fail(400,'Ugyldig strømstatus.');
  return {kind:e.kind,at:e.receivedAt,battery,charging:charging===null?null:charging?1:0};
 });
 const active=await resolveTraccarEnv(env);
 if(typeof data.serverUrl!=='string'||data.serverUrl!==traccarOrigin(active))fail(409,'Statuslæseren hører ikke til den aktive Traccar-server.');
 if(!await env.DB.prepare('SELECT identifier FROM trackers WHERE identifier=? AND owner_uid IS NOT NULL').bind(id).first())fail(403,'Trackeren er ikke tilknyttet.');
 await schema(env.DB);
 for(const e of events)await env.DB.prepare('INSERT INTO pejlo_report_state(identifier,source,kind,received_at,battery,charging) VALUES(?,?,?,?,?,?) ON CONFLICT(identifier,source,kind) DO UPDATE SET received_at=excluded.received_at,battery=excluded.battery,charging=excluded.charging WHERE excluded.received_at>received_at').bind(id,active.TRACCAR_SOURCE||'environment',e.kind,e.at,e.battery,e.charging).run();
 return {ok:true};
}

export async function readReportState(env,identifier){
 await schema(env.DB);
 const rows=await env.DB.prepare('SELECT kind,received_at,battery,charging FROM pejlo_report_state WHERE identifier=? AND source=?').bind(identifier,env.TRACCAR_SOURCE||'environment').all();
 const find=kind=>rows.results.find(r=>r.kind===kind)?.received_at??null;
 const sleep=rows.results.find(r=>r.kind==='sleep_report');
 return {lastSleepAt:sleep?.received_at??null,sleepBattery:sleep?.battery??null,lastPositionReportAt:find('position_report'),lastQueryReportAt:find('query_report'),lastHeartbeatAt:find('heartbeat')};
}
