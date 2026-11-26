import {activityAccess} from './activity-access.js';
import {ensureFamily} from './family.js';
import {ensureRestSessions} from './rest-session-store.js';
import {cleanAttachment} from '../../packages/shared/attachment.js';
import {restMovement} from '../../packages/shared/rest-session.js';
import {restSamples} from '../../packages/shared/rest-observation.js';
import {restObservation} from './rest-observation.js';
import {ensureRest} from './rest-store.js';
import {animalType} from '../../packages/shared/activity.js';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const clean=r=>r?{id:r.id,startedAt:r.started_at,endedAt:r.ended_at,reason:r.reason,checkedAt:r.checked_at,lastFixAt:r.last_fix}:null;
export async function restSessionAPI({db,uid,query,input,source='environment',now=Date.now()}){
 const v=input||query,{owner,editable,profile}=await activityAccess(db,uid,v,input);
 if(!profile||!v.identifier)fail(400,'Vælg et kæledyr med en tilknyttet tracker.');
 await ensureRestSessions(db);
 const args=[v.identifier,owner,profile.id,source];
 if(input){
  if(!editable)fail(403,'Du har kun læseadgang til hvileperioderne.');
  if(input.action==='start'){
   if(cleanAttachment(profile.attachment,v.identifier,now)?.state!=='worn')fail(409,'Markér først trackeren som påsat dyret, og gem profilen.');
   await ensureRest(db);
   const charge=await db.prepare('SELECT charging FROM pejlo_rest_reports WHERE identifier=? AND owner_uid=? AND profile_id=? AND source=? AND charging IS NOT NULL AND at>=? AND at<=? ORDER BY at DESC LIMIT 1').bind(...args,now-300000,now).first();
   if(charge?.charging===1)fail(409,'Trackeren rapporterer opladning. Start hvile, når den er på dyret igen.');
   if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id))fail(400,'Hent hvileknappen igen og prøv på ny.');
   await db.prepare('INSERT OR IGNORE INTO pejlo_rest_sessions(id,identifier,owner_uid,profile_id,source,started_at,actor_uid) VALUES(?,?,?,?,?,?,?)').bind(input.id,...args,now,uid).run();
   const row=await db.prepare('SELECT * FROM pejlo_rest_sessions WHERE id=? AND identifier=? AND owner_uid=? AND profile_id=? AND source=?').bind(input.id,...args).first();
   if(!row)fail(409,'Der er allerede en hvileperiode. Hent status igen.');
  }else if(input.action==='stop'){
   if(typeof input.id!=='string')fail(400,'Vælg den aktive hvileperiode.');
   const row=await db.prepare('SELECT * FROM pejlo_rest_sessions WHERE id=? AND identifier=? AND owner_uid=? AND profile_id=? AND source=?').bind(input.id,...args).first();
   if(!row)fail(409,'Hvileperioden er ændret. Hent status igen.');
   await db.prepare("UPDATE pejlo_rest_sessions SET ended_at=?,reason='manual',samples='[]' WHERE id=? AND ended_at IS NULL").bind(Math.max(now,row.started_at),row.id).run();
  }else fail(400,'Vælg start eller stop hvile.');
 }
 const active=await db.prepare('SELECT * FROM pejlo_rest_sessions WHERE identifier=? AND owner_uid=? AND profile_id=? AND source=? AND ended_at IS NULL').bind(...args).first();
 const history=await db.prepare('SELECT * FROM pejlo_rest_sessions WHERE identifier=? AND owner_uid=? AND profile_id=? AND source=? ORDER BY started_at DESC LIMIT 20').bind(...args).all();
 return {active:clean(active),history:history.results.map(clean),canEdit:editable,checkedAt:now};
}
export async function observeRestSession({db,identifier,owner,profile,source='environment',samples,now=Date.now(),historical=false}){
 await ensureRestSessions(db);
 const row=await db.prepare('SELECT * FROM pejlo_rest_sessions WHERE identifier=? AND owner_uid=? AND profile_id=? AND source=? AND ended_at IS NULL').bind(identifier,owner,profile.id,source).first();
 if(!row)return;
 const attachment=cleanAttachment(profile.attachment,identifier,now),current=restSamples(samples,now).filter(p=>p.timestamp>row.started_at&&(historical||now-p.timestamp<=900000));
 let previous=[];try{previous=JSON.parse(row.samples);}catch{}
 const all=restSamples([...previous,...current],now).filter(p=>p.timestamp>row.started_at),combined=all.filter(p=>now-p.timestamp<=900000).slice(-12);
 const move=restMovement(historical?all:combined,row.started_at,profile.type,now,historical);
 const charging=current.find(p=>p.charging===true);
 const candidates=[];
 if(!animalType(profile.type)||attachment?.state!=='worn')candidates.push({at:Math.max(row.started_at,Math.min(now,attachment?.since??now)),reason:'removed'});
 if(charging)candidates.push({at:charging.timestamp,reason:'charging'});
 if(move)candidates.push({at:move.at,reason:'movement'});
 const first=candidates.sort((a,b)=>a.at-b.at)[0],end=first?.at??null,reason=first?.reason||'';
 if(end!==null)await db.prepare("UPDATE pejlo_rest_sessions SET ended_at=?,reason=?,checked_at=?,last_fix=?,samples='[]' WHERE id=? AND ended_at IS NULL").bind(end,reason,now,move?.confirmedAt??charging?.timestamp??null,row.id).run();
 else await db.prepare('UPDATE pejlo_rest_sessions SET checked_at=?,last_fix=?,samples=? WHERE id=? AND ended_at IS NULL AND samples=?').bind(now,combined.filter(p=>p.valid).at(-1)?.timestamp??null,JSON.stringify(combined),row.id,row.samples).run();
}
// Uses ordinary Traccar reads. It never wakes the tracker or changes its interval.
export async function runRestSessions(env,fetcher,base,now=Date.now()){
 if(!env.DB||!env.TRACCAR_TOKEN||!base)return;
 await ensureRestSessions(env.DB);await ensureFamily(env.DB);
 const source=env.TRACCAR_SOURCE||'environment';
 const rows=await env.DB.prepare('SELECT s.*,p.profile FROM pejlo_rest_sessions s JOIN trackers t ON t.identifier=s.identifier AND t.owner_uid=s.owner_uid JOIN pejlo_profiles p ON p.identifier=s.identifier AND p.owner_uid=s.owner_uid WHERE s.source=? AND s.ended_at IS NULL AND s.checked_at<? ORDER BY s.checked_at LIMIT 8').bind(source,now-45000).all();
 const get=async path=>{const r=await fetcher(base+path,{headers:{Authorization:'Bearer '+env.TRACCAR_TOKEN,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Trackerstatus kunne ikke læses.');return r.json();};
 for(const row of rows.results){
  const profile=JSON.parse(row.profile);if(profile.id!==row.profile_id)continue;
  const device=(await get('/api/devices?uniqueId='+encodeURIComponent(row.identifier))).find(d=>d.uniqueId===row.identifier);
  if(!Number.isSafeInteger(device?.id))continue;
  const positions=device?.status==='online'&&device.positionId?await get('/api/positions?id='+encodeURIComponent(device.positionId)):[];
  const raw=positions.find(p=>p.deviceId===device.id&&p.id===device.positionId),p=raw?restObservation(raw):null;
  await observeRestSession({db:env.DB,identifier:row.identifier,owner:row.owner_uid,profile,source,samples:p?[p]:[],now});
  const claimed=await env.DB.prepare('UPDATE pejlo_rest_sessions SET history_checked_at=? WHERE id=? AND ended_at IS NULL AND history_checked_at<=? RETURNING reviewed_until').bind(now,row.id,now-300000).first();
  if(claimed){
   const from=Math.max(row.started_at,(claimed.reviewed_until||row.started_at)-15*60000),to=Math.min(now,from+86400000);
   // Bounded recovery of missed checks, using stored positions, never a query
   // command to the device. Only advance the cursor after a complete response.
   const history=await get('/api/reports/route?'+new URLSearchParams({deviceId:String(device.id),from:new Date(from).toISOString(),to:new Date(to).toISOString()}));
   if(Array.isArray(history)&&history.length<10000){
    const samples=history.filter(p=>p.deviceId===device.id&&Date.parse(p.fixTime)>=from&&Date.parse(p.fixTime)<=to).map(restObservation).filter(Boolean);
    await observeRestSession({db:env.DB,identifier:row.identifier,owner:row.owner_uid,profile,source,samples,now,historical:true});
    await env.DB.prepare('UPDATE pejlo_rest_sessions SET reviewed_until=? WHERE id=? AND reviewed_until=?').bind(to,row.id,claimed.reviewed_until).run();
   }
  }
 }
}
