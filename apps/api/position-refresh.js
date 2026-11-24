import {once} from './schema.js';
import {ensureFamily} from './family.js';
import {gpsPoint,trustedGps} from './gps.js';
import {sendPositionRequest} from './position-request.js';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const source=env=>env.TRACCAR_SOURCE||env.TRACCAR_URL||'environment';
export const refreshDevices=env=>[...new Set(String(env.PEJLO_POSITION_REFRESH_DEVICES??env.PEJLO_BATTERY_DEVICES??'').split(',').map(s=>s.trim()).filter(s=>/^\d{12}$/.test(s)))].slice(0,32);
export function ensurePositionRefresh(db){return once(db,'positionRefresh',()=>db.prepare(`CREATE TABLE IF NOT EXISTS pejlo_position_refresh(
 source TEXT NOT NULL,identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,
 minutes INTEGER NOT NULL DEFAULT 15,created_at INTEGER NOT NULL,checked_at INTEGER NOT NULL DEFAULT 0,
 last_attempt INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,result TEXT NOT NULL DEFAULT 'waiting',
 reason TEXT NOT NULL DEFAULT '',lease_until INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(source,identifier,owner_uid))`).run());}
async function init(env,identifier,uid,now){
 await ensurePositionRefresh(env.DB);
 await env.DB.prepare('INSERT OR IGNORE INTO pejlo_position_refresh(source,identifier,owner_uid,created_at) VALUES(?,?,?,?)').bind(source(env),identifier,uid,now).run();
}
export async function positionRefreshAPI({env,identifier,uid,input,now=Date.now()}){
 if(!refreshDevices(env).includes(identifier)){if(input)fail(409,'Automatisk positionsforespørgsel er ikke aktiveret for denne tracker.');return {available:false};}
 await init(env,identifier,uid,now);
 let row;
 if(input){
  if(typeof input.enabled!=='boolean'||![10,15].includes(input.minutes))fail(400,'Vælg 10 eller 15 minutter og om funktionen skal være slået til.');
  row=await env.DB.prepare(`UPDATE pejlo_position_refresh SET enabled=?,minutes=?,attempts=0,last_attempt=0,result='waiting',reason=''
   WHERE source=? AND identifier=? AND owner_uid=? AND lease_until<=? RETURNING *`).bind(input.enabled?1:0,input.minutes,source(env),identifier,uid,now).first();
  if(!row)fail(409,'En positionskontrol er i gang. Prøv igen om lidt.');
 }else row=await env.DB.prepare('SELECT * FROM pejlo_position_refresh WHERE source=? AND identifier=? AND owner_uid=?').bind(source(env),identifier,uid).first();
 const {enabled,minutes,attempts,last_attempt,result,reason,checked_at}=row;
 return {available:true,enabled:!!enabled,minutes,attempts,lastAttempt:last_attempt,result,reason,checkedAt:checked_at};
}
export function refreshDecision(row,{gpsAt,contactAt,online},now){
 const known=value=>Number.isFinite(value)&&value>0&&value<=now;
 const age=at=>now-(known(at)?at:row.created_at);
 const staleGps=age(gpsAt)>=row.minutes*60000,staleContact=age(contactAt)>=row.minutes*60000;
 if(!staleGps&&!staleContact)return {result:'fresh',reset:true};
 if(!online)return {result:'offline'};
 if(row.attempts>=3)return {result:'paused'};
 if(row.last_attempt&&now-row.last_attempt<15*60000)return {result:'waiting'};
 return {send:true,reason:staleGps&&staleContact?'both':staleGps?'gps':'contact'};
}
async function save(env,row){
 await env.DB.prepare(`UPDATE pejlo_position_refresh SET last_attempt=?,attempts=?,result=?,reason=?,lease_until=0
 WHERE source=? AND identifier=? AND owner_uid=? AND lease_until=?`).bind(row.last_attempt,row.attempts,row.result,row.reason,source(env),row.identifier,row.owner_uid,row.lease_until).run();
}
export async function runPositionRefresh(env,fetcher=fetch,base,now=Date.now()){
 const ids=refreshDevices(env);if(!env.DB||!env.TRACCAR_TOKEN||!base||!ids.length)return;
 await ensurePositionRefresh(env.DB);await ensureFamily(env.DB);
 const owners=await env.DB.prepare(`SELECT t.identifier,t.owner_uid FROM trackers t JOIN pejlo_profiles f ON f.identifier=t.identifier AND f.owner_uid=t.owner_uid WHERE t.owner_uid IS NOT NULL AND t.identifier IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all();
 for(const row of owners.results)await init(env,row.identifier,row.owner_uid,now);
 const candidates=await env.DB.prepare(`SELECT p.* FROM pejlo_position_refresh p JOIN trackers t ON t.identifier=p.identifier AND t.owner_uid=p.owner_uid JOIN pejlo_profiles f ON f.identifier=p.identifier AND f.owner_uid=p.owner_uid
 WHERE p.source=? AND p.enabled=1 AND p.lease_until<=? AND p.identifier IN (${ids.map(()=>'?').join(',')}) ORDER BY p.checked_at LIMIT 8`).bind(source(env),now,...ids).all();
 const traccarFetch=(path,options={})=>fetcher(base+path,{...options,headers:{Authorization:'Bearer '+env.TRACCAR_TOKEN,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},redirect:'manual',signal:AbortSignal.timeout(10000)});
 const traccar=async path=>{const r=await traccarFetch(path);if(!r.ok)throw Error('upstream');return r.json();};
 for(const candidate of candidates.results){
  const row=await env.DB.prepare(`UPDATE pejlo_position_refresh SET lease_until=?,checked_at=? WHERE source=? AND identifier=? AND owner_uid=? AND enabled=1 AND lease_until<=? RETURNING *`).bind(now+120000,now,source(env),candidate.identifier,candidate.owner_uid,now).first();
  if(!row)continue;
  try{
   const devices=await traccar('/api/devices?uniqueId='+encodeURIComponent(row.identifier));
   const device=devices.find(d=>d.uniqueId===row.identifier&&Number.isSafeInteger(d.id));
   if(!device){row.result='missing';continue;}
   // Offline devices cannot receive a no-queue command; retry the check after reconnection.
   if(device.status!=='online'){row.result='offline';continue;}
   const positions=device.positionId?await traccar('/api/positions?id='+encodeURIComponent(device.positionId)):[];
   const raw=positions.find(p=>p.id===device.positionId&&p.deviceId===device.id);
   const profileRow=await env.DB.prepare('SELECT profile FROM pejlo_profiles WHERE identifier=? AND owner_uid=?').bind(row.identifier,row.owner_uid).first();
   let profile={};try{profile=JSON.parse(profileRow?.profile||'{}');}catch{}
   const point=gpsPoint(raw);
   const gps=await trustedGps(env.DB,row.identifier,row.owner_uid,point?[point]:[],profile?.type||'object',profile?.homeConfirmed?profile.home:null,null,env.TRACCAR_SOURCE);
   const decision=refreshDecision(row,{gpsAt:gps.provisional?null:gps.trusted?.timestamp,contactAt:Date.parse(device.lastUpdate),online:true},now);
   if(decision.reset){row.attempts=0;row.last_attempt=0;row.reason='';}
   if(!decision.send){row.result=decision.result;continue;}
   if(!await env.DB.prepare('SELECT t.identifier FROM trackers t JOIN pejlo_profiles f ON f.identifier=t.identifier AND f.owner_uid=t.owner_uid WHERE t.identifier=? AND t.owner_uid=?').bind(row.identifier,row.owner_uid).first())continue;
   // Reserve the attempt before networking. Timeouts and crashes must retain the backoff.
   row.last_attempt=now;row.attempts++;row.result='uncertain';row.reason=decision.reason;
   await env.DB.prepare(`UPDATE pejlo_position_refresh SET last_attempt=?,attempts=?,result='uncertain',reason=? WHERE source=? AND identifier=? AND owner_uid=? AND lease_until=?`).bind(now,row.attempts,row.reason,source(env),row.identifier,row.owner_uid,row.lease_until).run();
   try{const result=await sendPositionRequest({db:env.DB,identifier:row.identifier,device,traccar,traccarFetch,now});row.result=result.status;}
   catch(e){row.result=e.status===429?'cooldown':e.status===409?'unsupported':'uncertain';}
  }catch{row.result='error';}
  finally{await save(env,row);}
 }
}
