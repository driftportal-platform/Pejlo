import {buildPushPayload} from '@block65/webcrypto-web-push';
import {validPoint} from '../../packages/shared/geo.js';
import {validPolygon,fenceDistance} from '../../packages/shared/fence.js';
export async function ensureNotifications(db){
 for(const sql of [
 'CREATE TABLE IF NOT EXISTS pejlo_fences (identifier TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL, enabled INTEGER NOT NULL, state TEXT NOT NULL DEFAULT \'{}\', checked_at INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS pejlo_push (endpoint TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, subscription TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS pejlo_push_queue (id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)'
 ])await db.prepare(sql).run();
}
export const pushReady=env=>!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);
export function validSubscription(s){try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&s.endpoint.length<2048&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'))&&/^[\w-]{87}$/.test(s.keys?.p256dh)&&/^[\w-]{22}$/.test(s.keys?.auth);}catch{return false;}}
export function validHome(home){return validPoint(home)&&Number.isFinite(home.radius)&&home.radius>=20&&home.radius<=5000&&(home.buffer===undefined||(Number.isFinite(home.buffer)&&home.buffer>=0&&home.buffer<=30))&&(['circle','polygon'].includes(home.shape))&&(home.shape!=='polygon'||validPolygon(home.points));}
export function advanceFence(home,raw,state,now=Date.now()){
 const time=Date.parse(raw?.fixTime);
 if(raw?.valid!==true||!validPoint({lat:raw.latitude,lon:raw.longitude})||!Number.isFinite(time)||time>now+60000||now-time>300000||time<=(state.last||0))return {state};
 const margin=fenceDistance(home,{lat:raw.latitude,lon:raw.longitude});
 if(typeof state.outside!=='boolean')return {state:{outside:margin>0,last:time,pending:0}};
 const buffer=home.buffer??5;
 const crossed=state.outside?margin< -buffer:margin>buffer;
 const pending=crossed?(state.pending||0)+1:0;
 return pending>=2?{state:{outside:!state.outside,last:time,pending:0},transition:state.outside?'enter':'exit'}:{state:{...state,last:time,pending}};
}
export async function sendPush(subscription,payload,env,fetcher=fetch){
 const request=await buildPushPayload({data:JSON.stringify(payload),options:{ttl:300} },subscription,{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
 return fetcher(subscription.endpoint,{...request,redirect:'manual',signal:AbortSignal.timeout(10000)});
}
export async function runNotifications(env,fetcher=fetch){
 if(!env.DB||!env.TRACCAR_TOKEN||!pushReady(env))return;
 await ensureNotifications(env.DB);
 const rows=await env.DB.prepare('SELECT f.* FROM pejlo_fences f JOIN trackers t ON t.identifier=f.identifier AND t.owner_uid=f.owner_uid WHERE f.enabled=1 ORDER BY f.checked_at LIMIT 8').all();
 const get=async path=>{const r=await fetcher('https://demo3.traccar.org'+path,{headers:{Authorization:'Bearer '+env.TRACCAR_TOKEN},redirect:'manual',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('upstream');return r.json();};
 for(const row of rows.results){
  try{
   await env.DB.prepare('UPDATE pejlo_fences SET checked_at=? WHERE identifier=?').bind(Date.now(),row.identifier).run();
   const devices=await get('/api/devices?uniqueId='+encodeURIComponent(row.identifier)),device=devices.find(d=>d.uniqueId===row.identifier);
   if(!device?.positionId)continue;
   const positions=await get('/api/positions?id='+device.positionId),raw=positions.find(p=>p.deviceId===device.id&&p.id===device.positionId);
   const result=advanceFence(JSON.parse(row.config),raw,JSON.parse(row.state));
   const updated=await env.DB.prepare('UPDATE pejlo_fences SET state=? WHERE identifier=? AND owner_uid=? AND state=? AND config=? AND enabled=1 RETURNING identifier').bind(JSON.stringify(result.state),row.identifier,row.owner_uid,row.state,row.config).first();
   if(updated&&result.transition){
    const id=row.identifier+':'+result.state.last+':'+result.transition;
    // Keep lock-screen messages generic: no names, coordinates, or tracker IDs.
    await env.DB.prepare('INSERT OR IGNORE INTO pejlo_push_queue (id,owner_uid,payload,created_at) VALUES (?,?,?,?)').bind(id,row.owner_uid,JSON.stringify({title:'Pejlo · hjemmeområde',body:result.transition==='exit'?'En tracker har forladt hjemmeområdet. Åbn Pejlo for at se mere.':'En tracker er tilbage i hjemmeområdet. Åbn Pejlo for at se mere.',tag:'pejlo-area',url:'/#kort'}),Date.now()).run();
   }
  }catch{ /* One tracker failure must not block others. No credentials in logs. */ }
 }
 const queue=await env.DB.prepare('SELECT * FROM pejlo_push_queue WHERE attempts<3 ORDER BY created_at LIMIT 4').all();
 for(const item of queue.results){
  if(Date.now()-item.created_at>300000){await env.DB.prepare('DELETE FROM pejlo_push_queue WHERE id=?').bind(item.id).run();continue;}
  const subs=await env.DB.prepare('SELECT * FROM pejlo_push WHERE owner_uid=? LIMIT 5').bind(item.owner_uid).all();let failed=false;
  for(const sub of subs.results){try{const r=await sendPush(JSON.parse(sub.subscription),JSON.parse(item.payload),env,fetcher);if(r.status===404||r.status===410)await env.DB.prepare('DELETE FROM pejlo_push WHERE endpoint=?').bind(sub.endpoint).run();else if(!r.ok)failed=true;}catch{failed=true;}}
  if(failed)await env.DB.prepare('UPDATE pejlo_push_queue SET attempts=attempts+1 WHERE id=?').bind(item.id).run();else await env.DB.prepare('DELETE FROM pejlo_push_queue WHERE id=?').bind(item.id).run();
 }
 await env.DB.prepare('DELETE FROM pejlo_push_queue WHERE attempts>=3 OR created_at<?').bind(Date.now()-300000).run();
}
