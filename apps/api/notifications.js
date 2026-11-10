import {currentHandoff,pruneHandoffs} from './handoffs.js';
import {trustedGps,gpsPoint} from './gps.js';
import {ensureOperations} from './operations.js';
import {snoozeUntil} from './snooze.js';
import {ensureArchive,archiveEvent,archiveStatus} from './archive.js';
import {once} from './schema.js';
import {notificationPayload,label} from './messages.js';
import {advanceFence} from '../../packages/shared/fence-events.js';
export {advanceFence} from '../../packages/shared/fence-events.js';
import {cleanAlerts,advanceAlerts,isQuiet,areaAlerts} from '../../packages/shared/alerts.js';
import {ensureFamily,trackerAccess} from './family.js';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {validPoint} from '../../packages/shared/geo.js';
import {validPolygon,fenceDistance} from '../../packages/shared/fence.js';
export function ensureNotifications(db){return once(db,'notifications',async()=>{
 for(const sql of [
 'CREATE TABLE IF NOT EXISTS pejlo_fences (identifier TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL, enabled INTEGER NOT NULL, state TEXT NOT NULL DEFAULT \'{}\', checked_at INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS pejlo_alerts(identifier TEXT NOT NULL,uid TEXT NOT NULL,config TEXT NOT NULL,state TEXT NOT NULL DEFAULT \'{}\',checked_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(identifier,uid))',
 'CREATE TABLE IF NOT EXISTS pejlo_events(id TEXT PRIMARY KEY,identifier TEXT NOT NULL,uid TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS pejlo_push (endpoint TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, subscription TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS pejlo_push_queue (id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)'
 ])await db.prepare(sql).run();
 // Upgrade the existing queue in place so pending notifications can still be sent.
 for(const sql of [
  "ALTER TABLE pejlo_events ADD COLUMN accepted_endpoints TEXT NOT NULL DEFAULT '[]'",
  'ALTER TABLE pejlo_events ADD COLUMN lease_until INTEGER NOT NULL DEFAULT 0'
 ])try{await db.prepare(sql).run();}catch(error){if(!/duplicate column/i.test(String(error?.message)))throw error;}
});}
export const pushReady=env=>!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);
export function validSubscription(s){try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&s.endpoint.length<2048&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'))&&/^[\w-]{87}$/.test(s.keys?.p256dh)&&/^[\w-]{22}$/.test(s.keys?.auth);}catch{return false;}}
export function validHome(home){return validPoint(home)&&Number.isFinite(home.radius)&&home.radius>=20&&home.radius<=5000&&(home.buffer===undefined||(Number.isFinite(home.buffer)&&home.buffer>=0&&home.buffer<=30))&&(['circle','polygon'].includes(home.shape))&&(home.shape!=='polygon'||validPolygon(home.points));}
export async function sendPush(subscription,payload,env,fetcher=fetch){
 const request=await buildPushPayload({data:JSON.stringify(payload),options:{ttl:300} },subscription,{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
 return fetcher(subscription.endpoint,{...request,redirect:'manual',signal:AbortSignal.timeout(10000)});
}
export {notificationPayload,messages} from './messages.js';
export async function runNotifications(env,fetcher=fetch){
 if(!env.DB)return;
 await ensureOperations(env.DB);const id=crypto.randomUUID(),started=Date.now(),stats={checked:0,errors:0,requests:0,upstreamErrors:0};
 await env.DB.prepare("INSERT INTO pejlo_runs(id,started_at,status) VALUES(?,?,'running')").bind(id,started).run();
 let status=env.TRACCAR_TOKEN?'completed':'missing-token';
 const tracked=async(url,options)=>{const upstream=url.startsWith('https://demo3.traccar.org/');if(upstream)stats.requests++;try{const r=await fetcher(url,options);if(upstream&&!r.ok)stats.upstreamErrors++;return r;}catch(e){if(upstream)stats.upstreamErrors++;throw e;}};
 try{await processNotifications(env,tracked,stats);if(stats.errors||stats.upstreamErrors)status='partial';}
 catch{status='failed';stats.errors++;}
 finally{
  await env.DB.prepare('UPDATE pejlo_runs SET finished_at=?,status=?,checked=?,errors=?,upstream_requests=?,upstream_errors=? WHERE id=?').bind(Date.now(),status,stats.checked,stats.errors,stats.requests,stats.upstreamErrors,id).run();
  await env.DB.prepare('DELETE FROM pejlo_runs WHERE id NOT IN(SELECT id FROM pejlo_runs ORDER BY started_at DESC LIMIT 20)').run();
 }
}
async function processNotifications(env,fetcher,stats){
 if(!env.DB||!env.TRACCAR_TOKEN)return;
 await ensureNotifications(env.DB);await ensureFamily(env.DB);await ensureArchive(env.DB);
 const rows=await env.DB.prepare(`SELECT t.identifier,t.owner_uid,t.name AS tracker_name,f.name AS fence_name,f.config,f.state,f.enabled FROM trackers t LEFT JOIN pejlo_fences f ON f.identifier=t.identifier AND f.owner_uid=t.owner_uid WHERE f.enabled=1 OR EXISTS(SELECT 1 FROM pejlo_alerts a WHERE a.identifier=t.identifier) ORDER BY COALESCE((SELECT MIN(a.checked_at) FROM pejlo_alerts a WHERE a.identifier=t.identifier),f.checked_at,0) LIMIT 8`).all();
 const get=async path=>{const r=await fetcher('https://demo3.traccar.org'+path,{headers:{Authorization:'Bearer '+env.TRACCAR_TOKEN},redirect:'manual',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('upstream');return r.json();};
 for(const row of rows.results){
  try{
   stats.checked++;const now=Date.now();
   await env.DB.prepare('UPDATE pejlo_fences SET checked_at=? WHERE identifier=?').bind(now,row.identifier).run();
   await env.DB.prepare('UPDATE pejlo_alerts SET checked_at=? WHERE identifier=?').bind(now,row.identifier).run();
   const devices=await get('/api/devices?uniqueId='+encodeURIComponent(row.identifier)),device=devices.find(d=>d.uniqueId===row.identifier);
   if(!device){stats.errors++;continue;}
   const positions=device.positionId?await get('/api/positions?id='+device.positionId):[],raw=positions.find(p=>p.deviceId===device.id&&p.id===device.positionId);
   const profileRow=await env.DB.prepare('SELECT profile FROM pejlo_profiles WHERE identifier=?').bind(row.identifier).first();
   let profile={};try{profile=JSON.parse(profileRow?.profile||'{}')||{};}catch{}
   // Include intermediate fixes: polling only the last one misses out-and-back spikes.
   let samples=[];
   try{const report=await get('/api/reports/route?'+new URLSearchParams({deviceId:String(device.id),from:new Date(now-300000).toISOString(),to:new Date(now).toISOString()}));
    if(Array.isArray(report))samples=report.filter(p=>p.deviceId===device.id).map(gpsPoint).filter(p=>p&&p.timestamp>=now-300000&&p.timestamp<=now);
   }catch{/* Persistent state still filters the latest fix when reports are unavailable. */}
   const current=gpsPoint(raw);if(current)samples.push(current);
   const gps=await trustedGps(env.DB,row.identifier,row.owner_uid,samples,profile.type||'object',profile.homeConfirmed===true?profile.home:null);
   const fenceRaw=current&&gps.trusted?.timestamp===current.timestamp&&!gps.uncertain?raw:null;
   const home=row.config?JSON.parse(row.config):null,areaId=home?.areaId??profile.activeFenceId??null;
   let transition;
   if(row.enabled){
    const result=advanceFence(home,fenceRaw,JSON.parse(row.state),now);
    const updated=await env.DB.prepare('UPDATE pejlo_fences SET state=? WHERE identifier=? AND owner_uid=? AND state=? AND config=? AND enabled=1 RETURNING identifier').bind(JSON.stringify(result.state),row.identifier,row.owner_uid,row.state,row.config).first();
    if(updated)transition=result.transition;
   }
   let profileName='';try{profileName=label(JSON.parse(profileRow?.profile??'null')?.name);}catch{}
   const name=profileName||label(row.tracker_name),fence=label(row.fence_name);
   const context={name,area:fence&&fence!==name?'«'+fence+'»':'hjemmeområdet',battery:raw?.attributes?.batteryLevel};
   const recipients=[row.owner_uid,...(await env.DB.prepare('SELECT uid FROM pejlo_members WHERE identifier=?').bind(row.identifier).all()).results.map(m=>m.uid)];
   const sharedPause=await currentHandoff(env.DB,row.identifier,now);
   for(const uid of new Set(recipients)){
    const prefs=await env.DB.prepare('SELECT config,state FROM pejlo_alerts WHERE identifier=? AND uid=?').bind(row.identifier,uid).first();
    const config=cleanAlerts(prefs?JSON.parse(prefs.config):null),result=advanceAlerts(config,raw,prefs?JSON.parse(prefs.state):{},now);
    if(prefs){
     const changed=await env.DB.prepare('UPDATE pejlo_alerts SET state=? WHERE identifier=? AND uid=? AND state=? AND config=? RETURNING identifier').bind(JSON.stringify(result.state),row.identifier,uid,prefs.state,prefs.config).first();
     if(!changed)continue;
    }
    const paused=sharedPause||await snoozeUntil(env.DB,row.identifier,uid)>now;
    const kinds=[...(transition?[transition]:[]),...result.events];
    for(const kind of kinds){
     const id=[row.identifier,uid,kind,kind==='missing'?result.state.lastFix||result.state.started:Date.parse(raw?.fixTime)||now].join(':');
     const enabled=kind===transition?areaAlerts(config,areaId)[kind]:config[kind==='battery'?'lowBattery':kind],quiet=isQuiet(config,now),ready=pushReady(env),payload=notificationPayload(kind,row.identifier,context);
     await archiveEvent(env.DB,{id,identifier:row.identifier,uid,kind,payload,createdAt:now,fixTime:Date.parse(raw?.fixTime),area:home?{name:row.fence_name,home}:null,status:paused?'snoozed':!enabled?'disabled':quiet?'quiet':!ready?'unconfigured':'pending'});
     if(enabled&&!quiet&&ready&&!paused)await env.DB.prepare('INSERT OR IGNORE INTO pejlo_events(id,identifier,uid,kind,payload,created_at) VALUES(?,?,?,?,?,?)').bind(id,row.identifier,uid,kind,JSON.stringify(kind===transition?{...payload,areaId}:payload),now).run();
    }
   }
  }catch{stats.errors++; /* Upstream failures cannot create geofence or battery events. */ }
 }
 await env.DB.prepare('DELETE FROM pejlo_alarm_history WHERE created_at<?').bind(Date.now()-90*86400000).run();
 await pruneHandoffs(env.DB,Date.now());
 if(!pushReady(env))return;
 const queue=await env.DB.prepare('SELECT id,attempts FROM pejlo_events WHERE attempts<3 AND lease_until<=? ORDER BY created_at LIMIT 4').bind(Date.now()).all();
 for(const queued of queue.results){
  const now=Date.now();
  const item=await env.DB.prepare('UPDATE pejlo_events SET lease_until=? WHERE id=? AND attempts=? AND lease_until<=? RETURNING *').bind(now+90000,queued.id,queued.attempts,now).first();
  if(!item)continue;
  const prefs=await env.DB.prepare('SELECT config FROM pejlo_alerts WHERE identifier=? AND uid=?').bind(item.identifier,item.uid).first(),config=cleanAlerts(prefs?JSON.parse(prefs.config):null);
  const {areaId,...payload}=JSON.parse(item.payload);
  const enabled=item.kind==='enter'||item.kind==='exit'
   ?areaAlerts(config,areaId)[item.kind]
   :item.kind==='fencechange'||config[item.kind==='battery'?'lowBattery':item.kind];
  const paused=await currentHandoff(env.DB,item.identifier)||await snoozeUntil(env.DB,item.identifier,item.uid)>Date.now();
  if(paused||Date.now()-item.created_at>300000||!enabled||isQuiet(config)||!await trackerAccess(env.DB,item.identifier,item.uid)){
   await archiveStatus(env.DB,item.id,paused?'snoozed':Date.now()-item.created_at>300000?'expired':'suppressed');await env.DB.prepare('DELETE FROM pejlo_events WHERE id=?').bind(item.id).run();continue;
  }
  const subs=await env.DB.prepare('SELECT * FROM pejlo_push WHERE owner_uid=? LIMIT 5').bind(item.uid).all();
  const accepted=new Set(JSON.parse(item.accepted_endpoints));
  let failed=false;
  for(const sub of subs.results){
   if(accepted.has(sub.endpoint))continue;
   let response;
   try{response=await sendPush(JSON.parse(sub.subscription),payload,env,fetcher);}
   catch{failed=true;continue;}
   if(response.ok){
    accepted.add(sub.endpoint);
    await env.DB.prepare('UPDATE pejlo_events SET accepted_endpoints=? WHERE id=? AND lease_until=?').bind(JSON.stringify([...accepted]),item.id,item.lease_until).run();
   }else if(response.status===404||response.status===410){
    await env.DB.prepare('DELETE FROM pejlo_push WHERE endpoint=? AND owner_uid=? AND subscription=?').bind(sub.endpoint,item.uid,sub.subscription).run();
   }else failed=true;
  }
  await archiveStatus(env.DB,item.id,failed?'retrying':accepted.size?'accepted':'no-device');
  if(failed)await env.DB.prepare('UPDATE pejlo_events SET attempts=attempts+1,lease_until=0 WHERE id=? AND lease_until=?').bind(item.id,item.lease_until).run();
  else await env.DB.prepare('DELETE FROM pejlo_events WHERE id=? AND lease_until=?').bind(item.id,item.lease_until).run();
 }
 await env.DB.prepare("UPDATE pejlo_alarm_history SET push_status='failed' WHERE id IN(SELECT id FROM pejlo_events WHERE attempts>=3)").run();
 await env.DB.prepare("UPDATE pejlo_alarm_history SET push_status='expired' WHERE push_status IN ('pending','retrying') AND id IN(SELECT id FROM pejlo_events WHERE created_at<? AND lease_until<=?)").bind(Date.now()-300000,Date.now()).run();
 await env.DB.prepare('DELETE FROM pejlo_events WHERE attempts>=3 OR (created_at<? AND lease_until<=?)').bind(Date.now()-300000,Date.now()).run();
 // Retire the earlier queue: its events have no revocable tracker access binding.
 await env.DB.prepare('DELETE FROM pejlo_push_queue').run();
}
