import {advanceFence} from '../../packages/shared/fence-events.js';
export {advanceFence} from '../../packages/shared/fence-events.js';
import {cleanAlerts,advanceAlerts,isQuiet} from '../../packages/shared/alerts.js';
import {ensureFamily,trackerAccess} from './family.js';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {validPoint} from '../../packages/shared/geo.js';
import {validPolygon,fenceDistance} from '../../packages/shared/fence.js';
export async function ensureNotifications(db){
 for(const sql of [
 'CREATE TABLE IF NOT EXISTS pejlo_fences (identifier TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL, enabled INTEGER NOT NULL, state TEXT NOT NULL DEFAULT \'{}\', checked_at INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS pejlo_alerts(identifier TEXT NOT NULL,uid TEXT NOT NULL,config TEXT NOT NULL,state TEXT NOT NULL DEFAULT \'{}\',checked_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(identifier,uid))',
 'CREATE TABLE IF NOT EXISTS pejlo_events(id TEXT PRIMARY KEY,identifier TEXT NOT NULL,uid TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS pejlo_push (endpoint TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, subscription TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS pejlo_push_queue (id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)'
 ])await db.prepare(sql).run();
}
export const pushReady=env=>!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);
export function validSubscription(s){try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&s.endpoint.length<2048&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'))&&/^[\w-]{87}$/.test(s.keys?.p256dh)&&/^[\w-]{22}$/.test(s.keys?.auth);}catch{return false;}}
export function validHome(home){return validPoint(home)&&Number.isFinite(home.radius)&&home.radius>=20&&home.radius<=5000&&(home.buffer===undefined||(Number.isFinite(home.buffer)&&home.buffer>=0&&home.buffer<=30))&&(['circle','polygon'].includes(home.shape))&&(home.shape!=='polygon'||validPolygon(home.points));}
export async function sendPush(subscription,payload,env,fetcher=fetch){
 const request=await buildPushPayload({data:JSON.stringify(payload),options:{ttl:300} },subscription,{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
 return fetcher(subscription.endpoint,{...request,redirect:'manual',signal:AbortSignal.timeout(10000)});
}
const messages={exit:'En tracker har forladt hjemmeområdet.',enter:'En tracker er tilbage i hjemmeområdet.',battery:'En trackers batteri er lavt.',missing:'Der mangler nye GPS-positioner fra en tracker.'};
export async function runNotifications(env,fetcher=fetch){
 if(!env.DB||!env.TRACCAR_TOKEN||!pushReady(env))return;
 await ensureNotifications(env.DB);await ensureFamily(env.DB);
 const rows=await env.DB.prepare(`SELECT t.identifier,t.owner_uid,f.config,f.state,f.enabled FROM trackers t LEFT JOIN pejlo_fences f ON f.identifier=t.identifier AND f.owner_uid=t.owner_uid WHERE f.enabled=1 OR EXISTS(SELECT 1 FROM pejlo_alerts a WHERE a.identifier=t.identifier) ORDER BY COALESCE((SELECT MIN(a.checked_at) FROM pejlo_alerts a WHERE a.identifier=t.identifier),f.checked_at,0) LIMIT 8`).all();
 const get=async path=>{const r=await fetcher('https://demo3.traccar.org'+path,{headers:{Authorization:'Bearer '+env.TRACCAR_TOKEN},redirect:'manual',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('upstream');return r.json();};
 for(const row of rows.results){
  try{
   const now=Date.now();
   await env.DB.prepare('UPDATE pejlo_fences SET checked_at=? WHERE identifier=?').bind(now,row.identifier).run();
   await env.DB.prepare('UPDATE pejlo_alerts SET checked_at=? WHERE identifier=?').bind(now,row.identifier).run();
   const devices=await get('/api/devices?uniqueId='+encodeURIComponent(row.identifier)),device=devices.find(d=>d.uniqueId===row.identifier);
   if(!device)continue;
   const positions=device.positionId?await get('/api/positions?id='+device.positionId):[],raw=positions.find(p=>p.deviceId===device.id&&p.id===device.positionId);
   let transition;
   if(row.enabled){
    const result=advanceFence(JSON.parse(row.config),raw,JSON.parse(row.state),now);
    const updated=await env.DB.prepare('UPDATE pejlo_fences SET state=? WHERE identifier=? AND owner_uid=? AND state=? AND config=? AND enabled=1 RETURNING identifier').bind(JSON.stringify(result.state),row.identifier,row.owner_uid,row.state,row.config).first();
    if(updated)transition=result.transition;
   }
   const recipients=[row.owner_uid,...(await env.DB.prepare('SELECT uid FROM pejlo_members WHERE identifier=?').bind(row.identifier).all()).results.map(m=>m.uid)];
   for(const uid of new Set(recipients)){
    const prefs=await env.DB.prepare('SELECT config,state FROM pejlo_alerts WHERE identifier=? AND uid=?').bind(row.identifier,uid).first();
    const config=cleanAlerts(prefs?JSON.parse(prefs.config):null),result=advanceAlerts(config,raw,prefs?JSON.parse(prefs.state):{},now);
    if(prefs){
     const changed=await env.DB.prepare('UPDATE pejlo_alerts SET state=? WHERE identifier=? AND uid=? AND state=? AND config=? RETURNING identifier').bind(JSON.stringify(result.state),row.identifier,uid,prefs.state,prefs.config).first();
     if(!changed)continue;
    }
    const kinds=[...(transition&&config[transition]?[transition]:[]),...result.events];
    if(isQuiet(config,now))continue; // Suppressed events are not replayed after quiet hours.
    for(const kind of kinds){
     const id=[row.identifier,uid,kind,kind==='missing'?result.state.lastFix||result.state.started:Date.parse(raw?.fixTime)||now].join(':');
     await env.DB.prepare('INSERT OR IGNORE INTO pejlo_events(id,identifier,uid,kind,payload,created_at) VALUES(?,?,?,?,?,?)').bind(id,row.identifier,uid,kind,JSON.stringify({title:'Pejlo',body:messages[kind]+' Åbn Pejlo for at se mere.',tag:'pejlo-'+kind,url:'/#kort'}),now).run();
    }
   }
  }catch{ /* Upstream failures cannot create geofence or battery events. */ }
 }
 const queue=await env.DB.prepare('SELECT * FROM pejlo_events WHERE attempts<3 ORDER BY created_at LIMIT 4').all();
 for(const item of queue.results){
  const prefs=await env.DB.prepare('SELECT config FROM pejlo_alerts WHERE identifier=? AND uid=?').bind(item.identifier,item.uid).first(),config=cleanAlerts(prefs?JSON.parse(prefs.config):null);
  const enabled=config[item.kind==='battery'?'lowBattery':item.kind];
  if(Date.now()-item.created_at>300000||!enabled||isQuiet(config)||!await trackerAccess(env.DB,item.identifier,item.uid)){
   await env.DB.prepare('DELETE FROM pejlo_events WHERE id=?').bind(item.id).run();continue;
  }
  const subs=await env.DB.prepare('SELECT * FROM pejlo_push WHERE owner_uid=? LIMIT 5').bind(item.uid).all();let failed=false;
  for(const sub of subs.results){try{const r=await sendPush(JSON.parse(sub.subscription),JSON.parse(item.payload),env,fetcher);if(r.status===404||r.status===410)await env.DB.prepare('DELETE FROM pejlo_push WHERE endpoint=?').bind(sub.endpoint).run();else if(!r.ok)failed=true;}catch{failed=true;}}
  if(failed)await env.DB.prepare('UPDATE pejlo_events SET attempts=attempts+1 WHERE id=?').bind(item.id).run();else await env.DB.prepare('DELETE FROM pejlo_events WHERE id=?').bind(item.id).run();
 }
 await env.DB.prepare('DELETE FROM pejlo_events WHERE attempts>=3 OR created_at<?').bind(Date.now()-300000).run();
 // Retire the earlier queue: its events have no revocable tracker access binding.
 await env.DB.prepare('DELETE FROM pejlo_push_queue').run();
}
