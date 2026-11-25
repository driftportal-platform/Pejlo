import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureFamily} from '../apps/api/family.js';
import {activityGpsAPI} from '../apps/api/activity-gps.js';
import {removeActivityProfile} from '../apps/api/activity-store.js';
import {deleteUserData} from '../apps/api/user-data.js';
import {newProfile} from '../packages/shared/profiles.js';
import {handleAPI} from '../apps/api/worker.js';
import {ensureRest} from '../apps/api/rest-store.js';
import {mergeActivity} from '../packages/shared/activity.js';
const now=Date.parse('2026-11-24T15:00:00Z'),identifier='317309';
async function fixture(){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT)');
 const db={prepare(sql){const s=raw.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async run(){return s.run(...args);},async first(){return s.get(...args)||null;},async all(){return {results:s.all(...args)};}};}};
 await ensureFamily(db);const profile={...newProfile('Loui','cat'),trackerId:identifier};raw.prepare('INSERT INTO trackers VALUES(?,?)').run(identifier,'owner');raw.prepare('INSERT INTO pejlo_profiles VALUES(?,?,?,1)').run(identifier,'owner',JSON.stringify(profile));raw.prepare('INSERT INTO pejlo_members VALUES(?,?,?,?)').run(identifier,'viewer','v@test.dk','viewer');
 const query={profileId:profile.id,type:'cat',identifier,from:'2026-11-23',to:'2026-11-24'},device={id:7};let calls=0,broken=false,points=[];
 const traccar=async(url)=>{calls++;if(broken)throw Error('upstream');const q=new URL('https://traccar.test'+url).searchParams;assert.ok(q.get('from').includes('T'));assert.ok(q.get('to').includes('T'));return points.filter(p=>Date.parse(p.fixTime)>=Date.parse(q.get('from'))&&Date.parse(p.fixTime)<=Date.parse(q.get('to')));};
 const api=(extra={})=>activityGpsAPI({db,uid:'owner',query,device,traccar,source:'server-a',now,...extra});
 return {db,raw,profile,query,api,get calls(){return calls;},set points(v){points=v;},set broken(v){broken=v;}};
}
const point=(time,latitude=56.5,extra={})=>({deviceId:7,fixTime:time,latitude,longitude:8.3,valid:true,attributes:{},...extra});

test('GPS rest is gated by wear history, uses the warm cache, unions dvale and obeys disabled/manual zero',async()=>{
 const f=await fixture(),start=Date.parse('2026-11-24T12:00:00Z'),day='2026-11-24',scope='profile:'+f.profile.id;
 await ensureRest(f.db);
 f.points=Array.from({length:10},(_,i)=>point(new Date(start+i*120000).toISOString(),56.5+(i%2)*.00001,{speed:0,attributes:{charge:false,sat:15}}));
 assert.equal((await f.api()).restDays.find(r=>r.day===day).estimatedRestHours,null,'no historical confirmation of wear');
 f.raw.prepare('INSERT INTO pejlo_rest_wear VALUES(?,?,?,?,?,?)').run(identifier,'owner',f.profile.id,1,start-60000,1);
 const a=await f.api();assert.equal(f.calls,1,'wear is applied after the cached GPS analysis');assert.equal(a.restDays.find(r=>r.day===day).estimatedRestMinutes,18);
 assert.ok(a.days.every(d=>!Object.hasOwn(d,'gpsRestIntervals')),'only day totals are sent to the app');
 for(const [kind,at,charge] of [['position_report',start,0],['sleep_report',start,null],['heartbeat',start+600000,null]])f.raw.prepare('INSERT INTO pejlo_rest_reports VALUES(?,?,?,?,?,?,?,?)').run(identifier,'server-a','owner',f.profile.id,at,kind,charge,null);
 const union=await f.api();assert.equal(union.restDays.find(r=>r.day===day).estimatedRestMinutes,18);
 assert.equal(mergeActivity([day],[{day,rest_hours:0}],union.days,union.restDays)[0].restHours,0);
 f.raw.prepare('INSERT INTO pejlo_rest_settings VALUES(?,?,0)').run('owner',scope);
 assert.deepEqual((await f.api()).restDays,[]);assert.equal(f.calls,1);
});

test('GPS rest history breaks at invalid charging reports and needs new evidence after removal',async()=>{
 const f=await fixture(),start=Date.parse('2026-11-24T12:00:00Z'),day='2026-11-24';await ensureRest(f.db);
 f.raw.prepare('INSERT INTO pejlo_rest_wear VALUES(?,?,?,?,?,?)').run(identifier,'owner',f.profile.id,1,start,1);
 f.points=Array.from({length:10},(_,i)=>point(new Date(start+i*120000).toISOString(),56.5,{speed:0,attributes:{charge:false,sat:15},...(i===4?{valid:false,attributes:{charge:true}}:{})}));
 assert.equal((await f.api()).restDays.find(r=>r.day===day).estimatedRestHours,null);
 f.points=Array.from({length:10},(_,i)=>point(new Date(start+i*120000).toISOString(),56.5,{speed:0,attributes:{charge:false,sat:15}}));
 f.raw.prepare('DELETE FROM pejlo_activity_gps').run();
 f.raw.prepare('INSERT INTO pejlo_rest_wear VALUES(?,?,?,?,?,?)').run(identifier,'owner',f.profile.id,2,start+600000,0);
 assert.equal((await f.api()).restDays.find(r=>r.day===day).estimatedRestHours,null,'short segments are not turned into rest');
});

test('cached pet summaries recalculate under the charging algorithm and never count charging as rest',async()=>{
 const f=await fixture();
 f.points=[point('2026-11-23T10:00:00Z'),point('2026-11-23T10:02:00Z',56.5003,{attributes:{charge:true}}),point('2026-11-23T10:04:00Z',56.5006)];
 const a=await f.api();assert.equal(a.days[0].km,null);assert.equal(a.days[0].observedMinutes,0);assert.equal(a.days[0].quietMinutes,0);assert.equal(a.chargingExcluded,1);
 assert.equal((await f.api()).chargingExcluded,1);assert.equal(f.calls,1);
 f.raw.prepare("UPDATE pejlo_activity_gps SET context=replace(context,'[4,','[3,')").run();
 const b=await f.api();assert.equal(f.calls,2);assert.equal(b.cachedDays,0);assert.equal(b.chargingExcluded,1);
});

test('unusable charging fixes still prevent false activity coverage across the charging interval',async()=>{
 const f=await fixture();f.points=[point('2026-11-23T10:00:00Z'),point('2026-11-23T10:02:00Z',56.5,{valid:false,attributes:{charge:true}}),point('2026-11-23T10:04:00Z')];
 const a=await f.api();assert.equal(a.days[0].km,null);assert.equal(a.days[0].observedMinutes,0);assert.equal(a.days[0].quietMinutes,0);
});

test('tracker history filters pet charging by default, supports inspection and retains live telemetry',async t=>{
 // Keep this interval within one day, also when the suite runs just after Danish midnight.
 const current=Date.parse('2026-11-24T12:00:00Z');t.mock.method(Date,'now',()=>current);
 const f=await fixture();
 const history=[false,true,false,true].map((charge,index)=>({...point(new Date(current-(7-index*2)*60000).toISOString(),56.5+index*0.0001,{attributes:{charge,batteryLevel:100}}),id:index+10,serverTime:new Date(current).toISOString()}));
 const latest=history.at(-1);
 const fetcher=async url=>{
  if(url.includes('accounts:lookup'))return Response.json({users:[{localId:'owner',emailVerified:true}]});
  if(url.includes('/api/devices?'))return Response.json([{id:7,uniqueId:identifier,positionId:latest.id,status:'online'}]);
  if(url.includes('/api/positions?'))return Response.json([latest]);
  if(url.includes('/api/reports/route?'))return Response.json(history);
  throw Error('Unexpected upstream');
 };
 const env={DB:f.db,TRACCAR_URL:'https://traccar.example.com',TRACCAR_TOKEN:'private-token'};
 const read=async extra=>{const r=await handleAPI(new Request('https://pejlo.test/api/tracker?identifier='+identifier+extra,{headers:{Authorization:'Bearer test'}}),env,fetcher);assert.equal(r.status,200);return r.json();};
 const normal=await read('');assert.equal(normal.route.length,2);assert.equal(normal.chargingExcluded,2);assert.equal(normal.telemetry.charging,true);assert.equal(normal.route[1].breakBefore,true);
 assert.ok(normal.restSamples.some(p=>p.charging===true),'charging observations remain barriers for rest even when excluded from the map route');
 const inspection=await read('&includeCharging=1');assert.equal(inspection.route.length,4);assert.equal(inspection.chargingIncluded,true);assert.equal(inspection.chargingExcluded,0);assert.deepEqual(inspection.position,normal.position);
 assert.deepEqual(inspection.restSamples,normal.restSamples,'showing charging routes does not enable animal rest');
 f.raw.prepare('UPDATE pejlo_profiles SET profile=?').run(JSON.stringify({...f.profile,type:'object'}));
 const object=await read('');assert.equal(object.route.length,4);assert.equal(object.chargingExcluded,0);
});
test('GPS day summaries persist and warm history avoids another Traccar route query',async()=>{
 const f=await fixture();f.points=[point('2026-11-23T10:00:00Z'),point('2026-11-23T10:02:00Z',56.5003)];
 const a=await f.api();assert.ok(a.days[0].km>0);assert.equal(a.days[0].observedMinutes,2);assert.equal(a.days[1].km,null);assert.equal(f.calls,1);
 assert.equal(a.route,undefined,'raw route never returned');const b=await f.api();assert.equal(f.calls,1);assert.equal(b.cachedDays,2);
 assert.deepEqual(b.days.map(d=>d.km),a.days.map(d=>d.km));
});
test('today refreshes after two minutes while completed days are retained for one day',async()=>{
 const f=await fixture();await f.api();await f.api({now:now+121000});assert.equal(f.calls,2);await f.api({now:now+86400001});assert.equal(f.calls,3);
});
test('cache is shared by authorized viewers but cannot bypass revoked access',async()=>{
 const f=await fixture();await f.api();assert.equal((await f.api({uid:'viewer'})).cachedDays,2);assert.equal(f.calls,1);
 f.raw.prepare('DELETE FROM pejlo_members').run();await assert.rejects(()=>f.api({uid:'viewer'}),{status:403});await assert.rejects(()=>f.api({uid:'stranger'}),{status:403});assert.equal(f.calls,1);
});
test('changed server and profile filter context invalidate cached summaries',async()=>{
 const f=await fixture();await f.api();await f.api({source:'server-b'});assert.equal(f.calls,2);
 f.raw.prepare('UPDATE pejlo_profiles SET profile=?').run(JSON.stringify({...f.profile,homeConfirmed:true}));await f.api({source:'server-b'});assert.equal(f.calls,3);
 await assert.rejects(()=>f.api({query:{...f.query,type:'dog'}}),{status:409});
});
test('GPS gaps, zero coordinates and invalid fixes never produce inferred rest',async()=>{
 const f=await fixture();f.points=[point('2026-11-23T10:00:00Z'),point('2026-11-23T10:10:00Z'),point('2026-11-23T10:12:00Z',0,{longitude:0}),point('2026-11-23T10:13:00Z',56.5,{valid:false})];
 const a=await f.api();assert.equal(a.days[0].km,null);assert.equal(a.days[0].observedMinutes,0);assert.equal(a.days[0].restHours,undefined);
});
test('failed upstream reads are never cached as zero activity',async()=>{
 const f=await fixture();f.broken=true;await assert.rejects(()=>f.api());assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_activity_gps').get().n,0);f.broken=false;await f.api();assert.equal(f.calls,2);
});
test('profile and account deletion remove their saved day summaries',async()=>{
 const f=await fixture();await f.api();assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_activity_gps').get().n,2);await removeActivityProfile(f.db,'owner',f.profile.id);assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_activity_gps').get().n,0);
 await f.api();await deleteUserData(f.db,'owner');assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_activity_gps').get().n,0);
});
test('day boundaries and cached results are independent of the requested range',async()=>{
 const f=await fixture();f.points=[point('2026-11-23T22:59:00Z'),point('2026-11-23T23:00:00Z'),point('2026-11-23T23:02:00Z',56.5003)];
 const a=await f.api();const b=await f.api({source:'fresh',query:{...f.query,from:'2026-11-24'}});assert.equal(a.days[1].km,b.days[0].km);assert.equal(b.days[0].observedMinutes,2);assert.equal(a.days[0].observedMinutes,0);
});
test('midnight refreshes yesterday even when the cached partial-day result is recent',async()=>{
 const f=await fixture(),before=Date.parse('2026-11-24T22:59:30Z');
 await f.api({now:before,query:{...f.query,from:'2026-11-24'}});
 const result=await f.api({now:before+60000,query:{...f.query,from:'2026-11-24',to:'2026-11-25'}});
 assert.equal(f.calls,2);assert.equal(result.days[0].cached,false);assert.equal(result.days[0].closed,true);
});
test('a capped history report is flagged and cannot poison the daily cache',async()=>{
 const f=await fixture();f.points=Array.from({length:10000},()=>point('2026-11-23T10:00:00Z'));
 const result=await f.api();assert.equal(result.historyTruncated,true);assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_activity_gps').get().n,0);
});
test('invalid dates never trigger a route request or populate the cache',async()=>{
 const f=await fixture();for(const dates of [{from:'2026-11-25'},{from:'2026-01-01'},{from:'oops'}])await assert.rejects(()=>f.api({query:{...f.query,...dates}}));assert.equal(f.calls,0);
});
test('HTTP GPS-summary endpoint returns day totals through the authorized Traccar path',async()=>{
 const f=await fixture();let routes=0;
 const fetcher=async(url)=>{
  if(url.includes('accounts:lookup'))return Response.json({users:[{localId:'viewer',emailVerified:true}]});
  if(url.includes('/api/devices?'))return Response.json([{id:7,uniqueId:identifier}]);
  if(url.includes('/api/reports/route?')){routes++;return Response.json([point('2026-11-23T10:00:00Z'),point('2026-11-23T10:02:00Z',56.5003)]);}
  throw Error('Unexpected upstream request');
 };
 const url='https://pejlo.test/api/activity/gps?'+new URLSearchParams(f.query),headers={Authorization:'Bearer test'},env={DB:f.db,TRACCAR_URL:'https://traccar.example.com',TRACCAR_TOKEN:'private-token'};
 const r=await handleAPI(new Request(url,{headers}),env,fetcher);assert.equal(r.status,200);const data=await r.json();assert.ok(data.days[0].km>0);assert.equal(data.route,undefined);
 assert.equal((await handleAPI(new Request(url,{headers}),env,fetcher)).status,200);assert.equal(routes,1);
 f.raw.prepare('DELETE FROM pejlo_members').run();assert.equal((await handleAPI(new Request(url,{headers}),env,fetcher)).status,403);assert.equal(routes,1);
});
