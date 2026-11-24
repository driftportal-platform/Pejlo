import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensurePositionRefresh,positionRefreshAPI,runPositionRefresh,refreshDecision} from '../apps/api/position-refresh.js';
import {ensureGps} from '../apps/api/gps.js';
import {deleteUserData} from '../apps/api/user-data.js';
import {createPositionRefresh} from '../apps/web/src/features/position-refresh.js';

const identifier='080608317309',uid='owner';
async function fixture(){
 const now=Date.now(),raw=new DatabaseSync(':memory:');
 raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT); CREATE TABLE pejlo_profiles(identifier TEXT PRIMARY KEY,owner_uid TEXT,profile TEXT)');
 raw.prepare('INSERT INTO trackers VALUES(?,?)').run(identifier,uid);raw.prepare('INSERT INTO pejlo_profiles VALUES(?,?,?)').run(identifier,uid,JSON.stringify({type:'cat'}));
 const db={prepare(sql){const s=raw.prepare(sql);let a=[];return {bind(...v){a=v;return this;},async first(){return s.get(...a)||null;},async run(){return s.run(...a);},async all(){return {results:s.all(...a)};}};}};
 const env={DB:db,TRACCAR_TOKEN:'secret',PEJLO_BATTERY_DEVICES:identifier,TRACCAR_SOURCE:'one'};
 await ensureGps(db);const point={lat:56.5,lon:8.3,timestamp:now-20*60000};
 raw.prepare('INSERT INTO pejlo_gps_filter VALUES(?,?,?)').run('gps-only-v1:one:'+identifier,uid,JSON.stringify({trusted:point,seen:point.timestamp,provisional:false,uncertain:false}));
 const device={id:1,uniqueId:identifier,positionId:2,status:'online',lastUpdate:new Date(now).toISOString()};
 let position={id:2,deviceId:1,valid:false,latitude:56.5,longitude:8.3,fixTime:new Date(now).toISOString()},status=200,types=[{type:'positionSingle'}],broken=false,lookupError=false;
 const sent=[];
 const fetcher=async(url,options={})=>{
  assert.equal(options.headers.Authorization,'Bearer secret');
  if(url.includes('/commands/send')){sent.push(JSON.parse(options.body));if(broken)throw Error('timeout');return Response.json({}, {status});}
  if(url.includes('/commands/types'))return Response.json(types);
  if(url.includes('/devices?'))return Response.json([device]);
  if(lookupError)return new Response('',{status:503});
  return Response.json([position]);
 };
 const tick=(time=now)=>runPositionRefresh(env,fetcher,'https://example.test',time);
 const read=()=>raw.prepare('SELECT * FROM pejlo_position_refresh WHERE source=? AND identifier=? AND owner_uid=?').get(env.TRACCAR_SOURCE,identifier,uid);
 const api=(input,time=now)=>positionRefreshAPI({env,identifier,uid,input,now:time});
 return {now,raw,db,env,device,sent,tick,read,api,setStatus:v=>status=v,setTypes:v=>types=v,setBroken:v=>broken=v,setLookupError:v=>lookupError=v,setPosition:v=>position={...position,...v}};
}
test('stale GPS triggers a fixed no-queue request without an open browser',async()=>{
 const f=await fixture();await f.tick();assert.deepEqual(f.sent,[{deviceId:1,type:'positionSingle',textChannel:false,attributes:{noQueue:true}}]);assert.equal(f.read().result,'sent');assert.equal(f.read().reason,'gps');
});
test('fresh approved GPS and contact send nothing; stale contact alone can trigger',async()=>{
 const f=await fixture();f.setPosition({valid:true,fixTime:new Date(f.now-1000).toISOString()});await f.tick();assert.equal(f.sent.length,0);
 f.device.lastUpdate=new Date(f.now-16*60000).toISOString();await f.tick(f.now+1000);assert.equal(f.sent.length,1);assert.equal(f.read().reason,'contact');
});
test('offline waits for reconnection and lookup failures never fabricate a stale GPS observation',async()=>{
 const f=await fixture();f.device.status='offline';await f.tick();assert.equal(f.sent.length,0);assert.equal(f.read().result,'offline');
 f.device.status='online';f.setLookupError(true);await f.tick(f.now+60000);assert.equal(f.sent.length,0);assert.equal(f.read().result,'error');
 f.setLookupError(false);await f.tick(f.now+120000);assert.equal(f.sent.length,1);
});
test('backoff and the three-attempt cap prevent repeated requests; fresh data recovers',async()=>{
 const f=await fixture();await f.tick();await f.tick(f.now+60000);assert.equal(f.sent.length,1);
 await f.tick(f.now+15*60000);await f.tick(f.now+30*60000);await f.tick(f.now+45*60000);assert.equal(f.sent.length,3);assert.equal(f.read().result,'paused');
 f.setPosition({valid:true,fixTime:new Date(f.now-1000).toISOString()});f.device.lastUpdate=new Date(f.now).toISOString();
 await f.tick(f.now+1000);assert.equal(f.read().attempts,0);assert.equal(f.read().result,'fresh');
});
test('queued, failed and timed-out sends all retain the automatic backoff',async()=>{
 for(const code of [202,503,'timeout']){const f=await fixture();if(code==='timeout')f.setBroken(true);else f.setStatus(code);await f.tick();await f.tick(f.now+60000);assert.equal(f.sent.length,1);assert.equal(f.read().attempts,1);assert.equal(f.read().result,'waiting');}
});
test('overlapping cron invocations send only one command',async()=>{
 const f=await fixture();await Promise.all([f.tick(),f.tick()]);assert.equal(f.sent.length,1);
});
test('unsupported devices never receive a custom fallback and manual requests share the minute limit',async()=>{
 const f=await fixture();f.setTypes([{type:'custom'}]);await f.tick();assert.equal(f.sent.length,0);assert.equal(f.read().result,'unsupported');
 const g=await fixture();await ensurePositionRefresh(g.db);g.raw.exec('CREATE TABLE pejlo_position_requests(identifier TEXT PRIMARY KEY,requested_at INTEGER NOT NULL)');g.raw.prepare('INSERT INTO pejlo_position_requests VALUES(?,?)').run(identifier,g.now-1000);await g.tick();assert.equal(g.sent.length,0);assert.equal(g.read().result,'cooldown');
});
test('owner/source/allowlist, pause setting and account deletion prevent automatic dispatch',async()=>{
 for(const change of ['owner','source','allowlist','disabled','deleted']){
  const f=await fixture();await f.api();
  if(change==='owner')f.raw.prepare('UPDATE trackers SET owner_uid=?').run('other');
  if(change==='source')f.env.TRACCAR_SOURCE='two';
  if(change==='allowlist')f.env.PEJLO_POSITION_REFRESH_DEVICES='';
  if(change==='disabled')await f.api({enabled:false,minutes:15});
  if(change==='deleted')await deleteUserData(f.db,uid);
  await f.tick();assert.equal(f.sent.length,0,change);
 }
});
test('settings validate thresholds and locking; reading settings itself sends nothing',async()=>{
 const f=await fixture(),r=await f.api();assert.equal(r.enabled,true);assert.equal(r.minutes,15);assert.equal(f.sent.length,0);
 await f.api({enabled:true,minutes:10});assert.equal((await f.api()).minutes,10);
 await assert.rejects(()=>f.api({enabled:true,minutes:1}),{status:400});
 f.raw.prepare('UPDATE pejlo_position_refresh SET lease_until=?').run(f.now+60000);await assert.rejects(()=>f.api({enabled:false,minutes:15}),{status:409});
});
test('new devices without any trusted fix wait a full threshold, and future times do not count as fresh',()=>{
 const now=Date.now(),row={created_at:now,minutes:15,attempts:0,last_attempt:0};
 assert.equal(refreshDecision(row,{online:true},now+899999).send,undefined);
 assert.equal(refreshDecision(row,{online:true},now+900000).send,true);
 assert.equal(refreshDecision(row,{online:true,gpsAt:now+8*3600000,contactAt:now+8*3600000},now+900000).send,true);
});
test('UI late responses cannot enable controls for the previously selected profile',async()=>{
 const fields=Object.fromEntries(['fieldset','enabled','minutes','status','save','refresh'].map(k=>['[data-position-refresh-'+k+']',{}]));let resolve;
 const ui=createPositionRefresh({root:{querySelector:k=>fields[k]},selected:()=>({trackerId:identifier}),canEdit:()=>true,request:()=>new Promise(r=>resolve=r)});
 const pending=ui.load();ui.clear();resolve({available:true,enabled:true,minutes:15});await pending;assert.equal(fields['[data-position-refresh-fieldset]'].disabled,true);
});
