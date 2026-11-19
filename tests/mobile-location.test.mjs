import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {approximatePoint,gpsPoint,trustedGps} from '../apps/api/gps.js';
import {locationEnabled,setLocationAccess} from '../apps/api/location-access.js';
import {displayPosition} from '../packages/shared/location-display.js';
import {handleAPI} from '../apps/api/worker.js';

function database(){
 const raw=new DatabaseSync(':memory:');
 raw.exec("CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT); INSERT INTO trackers VALUES('1234','owner')");
 return {raw,prepare(sql){const stmt=raw.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async run(){return stmt.run(...args);},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};}};}};
}
const rawPoint=(now=Date.now())=>({id:7,deviceId:1,valid:true,latitude:56.5,longitude:8.3,accuracy:1200,fixTime:new Date(now).toISOString(),serverTime:new Date(now).toISOString(),attributes:{approximate:true,batteryLevel:90}});

test('a signed-in account can read its own mobile permission without a tracker and cannot select another account',async()=>{
 const DB=database();DB.raw.exec("ALTER TABLE trackers ADD COLUMN name TEXT; DELETE FROM trackers");
 const fetcher=async url=>{
  assert.ok(url.includes('accounts:lookup'),'permission status must not depend on a Traccar connection');
  return Response.json({users:[{localId:'viewer',emailVerified:true}]});
 };
 await setLocationAccess(DB,'owner',true);
 const request=()=>handleAPI(new Request('https://pejlo.example/api/trackers?uid=owner',{headers:{Authorization:'Bearer user'}}),{DB},fetcher);
 let response=await request();assert.equal(response.status,200);let data=await response.json();
 assert.equal(data.uid,'viewer');assert.equal(data.mobileLocationEnabled,false);assert.deepEqual(data.trackers,[]);
 await setLocationAccess(DB,'viewer',true);
 data=await (await request()).json();assert.equal(data.mobileLocationEnabled,true);
 await setLocationAccess(DB,'viewer',false);
 data=await (await request()).json();assert.equal(data.mobileLocationEnabled,false);
});

test('mobile estimates never enter trusted GPS or GPS routes, even with tiny accuracy',()=>{
 assert.equal(gpsPoint(rawPoint()),null);
 assert.equal(gpsPoint({...rawPoint(),accuracy:1}),null);
 assert.equal(gpsPoint({...rawPoint(),attributes:{},outdated:true}),null);
 assert.ok(gpsPoint({...rawPoint(),attributes:{},accuracy:10}));
});
test('an estimate needs nonzero valid coordinates, known radius and fresh report and fix',()=>{
 const now=Date.now(),raw=rawPoint(now);
 assert.equal(approximatePoint(raw,now).accuracy,1200);
 for(const change of [{valid:false},{accuracy:0},{accuracy:Infinity},{latitude:0,longitude:0},{latitude:100},{fixTime:new Date(now+120000).toISOString()},{serverTime:new Date(now-360000).toISOString()},{fixTime:new Date(now-360000).toISOString()},{attributes:{}}])assert.equal(approximatePoint({...raw,...change},now),null);
});
test('fresh GPS takes precedence and expired or disabled estimates never display',()=>{
 const now=Date.now(),estimate=approximatePoint(rawPoint(now),now),gps={lat:56,lon:8,timestamp:now-60000};
 const data={position:gps,approximatePosition:estimate,mobileLocationEnabled:true};
 assert.equal(displayPosition(data,now),gps);
 const old={...gps,timestamp:now-400000};
 assert.equal(displayPosition({...data,position:old},now),estimate);
 assert.equal(displayPosition({...data,position:old,mobileLocationEnabled:false},now),old);
 assert.equal(displayPosition({...data,position:old},now+400000),old);
 assert.equal(displayPosition({...data,position:null},now),estimate);
});
test('mobile access defaults off, isolates accounts and can be revoked',async()=>{
 const db=database();assert.equal(await locationEnabled(db,'owner'),false);
 await setLocationAccess(db,'owner',true);
 assert.equal(await locationEnabled(db,'owner'),true);
 assert.equal(await locationEnabled(db,'viewer'),false);
 await setLocationAccess(db,'owner',false);assert.equal(await locationEnabled(db,'owner'),false);
});
test('old untagged GPS cache is isolated so a previously stored mobile fix cannot survive upgrade',async()=>{
 const db=database();
 await trustedGps(db,'1234','owner',[],'cat');
 db.raw.prepare("INSERT INTO pejlo_gps_filter VALUES(?,?,?)").run('1234','owner',JSON.stringify({trusted:{lat:55,lon:9,timestamp:Date.now()}}));
 assert.equal((await trustedGps(db,'1234','owner',[],'cat')).trusted,undefined);
});
test('tracker endpoint enforces mobile access server-side and returns no estimate when disabled',async()=>{
 const DB=database(),env={DB,TRACCAR_TOKEN:'server-token'},raw=rawPoint();
 const fetcher=async url=>{
  if(url.includes('accounts:lookup'))return Response.json({users:[{localId:'owner',emailVerified:true}]});
  if(url.includes('/api/devices?'))return Response.json([{id:1,uniqueId:'1234',positionId:7,status:'online'}]);
  if(url.includes('/api/positions?'))return Response.json([raw]);
  if(url.includes('/api/reports/route?'))return Response.json([raw]);
  throw Error('Unexpected upstream');
 };
 const request=()=>handleAPI(new Request('https://pejlo.example/api/tracker?identifier=1234',{headers:{Authorization:'Bearer user'}}),env,fetcher);
 let response=await request();assert.equal(response.status,200);let data=await response.json();
 assert.equal(data.mobileLocationEnabled,false);assert.equal(data.approximatePosition,null);assert.equal(data.position,null);assert.deepEqual(data.route,[]);
 await setLocationAccess(DB,'owner',true);
 data=await (await request()).json();assert.equal(data.mobileLocationEnabled,true);assert.equal(data.approximatePosition.accuracy,1200);assert.equal(data.position,null);assert.deepEqual(data.route,[]);
 await setLocationAccess(DB,'owner',false);
 data=await (await request()).json();assert.equal(data.approximatePosition,null);
});
