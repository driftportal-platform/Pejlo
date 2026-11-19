import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {serverConfigAPI,resolveTraccarEnv} from '../apps/api/server-config.js';
import {handleAPI} from '../apps/api/worker.js';
import {trustedGps,gpsPoint} from '../apps/api/gps.js';
import {gpsStatus} from '../packages/shared/gps-status.js';
function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,name TEXT NOT NULL,code_hash TEXT NOT NULL,owner_uid TEXT,claimed_at TEXT)');
 sql.exec("INSERT INTO trackers VALUES('tracker-1','Loui','hash','owner',NULL)");
 const DB={prepare(query){const statement=sql.prepare(query);let args=[];return {bind(...v){args=v;return this;},async first(){return statement.get(...args);},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};}};
 const env={DB,TRACCAR_TOKEN:'old-token',TRACCAR_CONFIG_SECRET:'a-unique-encryption-secret-with-32-plus-characters'};
 const input={url:'https://pejlo.duckdns.org',token:'private-new-token',revision:'environment'};
 const calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return Response.json([{id:1,uniqueId:'tracker-1',name:'Loui',phone:'hidden'}]);};
 return {env,sql,input,calls,fetcher};
}
test('test is read-only, sanitized, redirects disabled and token never returned',async()=>{
 const {env,sql,input,fetcher,calls}=setup();
 const result=await serverConfigAPI(env,{...input,action:'test'},fetcher);
 assert.deepEqual(result.missing,[]);assert.deepEqual(result.devices,[{identifier:'tracker-1',name:'Loui'}]);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='pejlo_server_config'").get().n,0);
 assert.equal(JSON.stringify(result).includes(input.token),false);
 assert.equal(calls[0].options.redirect,'manual');assert.equal(calls[0].options.headers.Authorization,'Bearer '+input.token);
});
test('activation persists encrypted credentials, resolves for consumers, preserves environment fallback',async()=>{
 const {env,sql,input,fetcher}=setup();
 assert.equal((await resolveTraccarEnv(env)).TRACCAR_TOKEN,'old-token');
 await serverConfigAPI(env,{...input,action:'activate'},fetcher);
 const stored=sql.prepare('SELECT config_value FROM pejlo_server_config').get().config_value;
 assert.equal(stored.includes(input.token),false);assert.equal(stored.includes(input.url),false);
 const active=await resolveTraccarEnv(env);assert.equal(active.TRACCAR_TOKEN,input.token);assert.equal(active.TRACCAR_URL,input.url);assert.ok(active.TRACCAR_SOURCE);
 const status=await serverConfigAPI(env,null,fetcher);assert.equal(status.url,input.url);assert.equal(JSON.stringify(status).includes(input.token),false);
 await assert.rejects(serverConfigAPI(env,{...input,action:'activate'},fetcher),e=>e.status===409);
 await assert.rejects(resolveTraccarEnv({...env,TRACCAR_CONFIG_SECRET:'a-different-secret-with-32-plus-characters'}),e=>e.status===503);
});
test('failed test, missing trackers or encryption key never changes active configuration',async()=>{
 for(const scenario of ['missing','unauthorized','redirect','malformed','network','key']){
  const {env,input,fetcher}=setup();
  const fn=scenario==='missing'?async()=>Response.json([]):scenario==='unauthorized'?async()=>new Response('',{status:401}):scenario==='redirect'?async()=>new Response('',{status:302}):scenario==='malformed'?async()=>Response.json({}):scenario==='network'?async()=>{throw Error('secret in upstream error');}:fetcher;
  if(scenario==='key')delete env.TRACCAR_CONFIG_SECRET;
  await assert.rejects(serverConfigAPI(env,{...input,action:'activate'},fn));
  assert.equal((await resolveTraccarEnv(env)).TRACCAR_TOKEN,'old-token');
 }
});
test('candidate rejects HTTP, local destinations, credentials and token injection before fetch',async()=>{
 const {env,input}=setup();let count=0;const fn=async()=>{count++;throw Error();};
 for(const url of ['http://pejlo.duckdns.org','https://localhost','https://127.0.0.1','https://[::1]','https://a.local','https://user:pass@example.com','https://example.com/path','https://example.com?x=1']){
  await assert.rejects(serverConfigAPI(env,{...input,url,action:'test'},fn),e=>e.status===400);
 }
 await assert.rejects(serverConfigAPI(env,{...input,token:'abc\r\nheader',action:'test'},fn),e=>e.status===400);assert.equal(count,0);
});
test('ordinary users cannot read, test or activate server settings',async()=>{
 const {env}=setup();env.TRACCAR_ADMIN_UID='admin';let count=0;
 const fn=async()=>{count++;return Response.json({users:[{localId:'member',emailVerified:true}]});};
 for(const method of ['GET','POST']){
  const response=await handleAPI(new Request('https://app.example/api/admin/server',{method,headers:{Authorization:'Bearer firebase'},...(method==='POST'?{body:JSON.stringify({action:'activate'})}:{})}),env,fn);
  assert.equal(response.status,403);
 }
 assert.equal(count,2);
});
test('new server GPS state cannot reuse a former server position or battery',async()=>{
 const {env}=setup(),point={lat:56.55,lon:8.31,timestamp:Date.now(),valid:true};
 await trustedGps(env.DB,'tracker-1','owner',[point],'cat',null,{level:52,timestamp:point.timestamp},'old');
 const fresh=await trustedGps(env.DB,'tracker-1','owner',[],'cat',null,undefined,'new');
 assert.equal(fresh.trusted,undefined);assert.equal(fresh.batteryReading,undefined);
});
test('zero coordinates are rejected even when marked valid, invalid fixes retain genuine trusted timestamps',async()=>{
 assert.equal(gpsPoint({valid:true,latitude:0,longitude:0,fixTime:new Date().toISOString()}),null);
 const {env}=setup(),point={lat:56.55,lon:8.31,timestamp:Date.now()-100000,valid:true};
 await trustedGps(env.DB,'tracker-1','owner',[point],'cat',null);
 const retained=await trustedGps(env.DB,'tracker-1','owner',[],'cat',null);
 assert.deepEqual(retained.trusted,point);
 assert.equal(gpsStatus({position:null,gpsUncertain:true}).label,'GPS-position mangler');
});

test('tracker API reads the active server and keeps telemetry for invalid zero fixes',async()=>{
 const {env,input,fetcher}=setup();env.TRACCAR_ADMIN_UID='admin';
 await serverConfigAPI(env,{...input,action:'activate'},fetcher);
 const calls=[];
 const fn=async(url,options)=>{
  if(url.includes('accounts:lookup'))return Response.json({users:[{localId:'owner',emailVerified:true}]});
  calls.push(url);assert.equal(new URL(url).origin,input.url);assert.equal(options.headers.Authorization,'Bearer '+input.token);
  if(url.includes('/api/devices?'))return Response.json([{id:1,uniqueId:'tracker-1',positionId:2,status:'online',lastUpdate:new Date().toISOString()}]);
  if(url.includes('/api/positions?'))return Response.json([{id:2,deviceId:1,valid:false,latitude:0,longitude:0,fixTime:new Date().toISOString(),serverTime:new Date().toISOString(),attributes:{sat:0,rssi:15,batteryLevel:100,charge:true}}]);
  if(url.includes('/api/reports/route?'))return Response.json([]);
  throw Error('Unexpected request');
 };
 const r=await handleAPI(new Request('https://app.example/api/tracker?identifier=tracker-1',{headers:{Authorization:'Bearer firebase'}}),env,fn);
 const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));assert.equal(result.position,null);assert.equal(result.telemetry.battery,100);assert.equal(result.telemetry.rssi,15);assert.equal(result.telemetry.satellites,0);assert.equal(result.device.status,'online');assert.ok(calls.length);assert.equal(JSON.stringify(result).includes(input.token),false);
});

test('background monitoring uses the active encrypted server selection',async()=>{
 const {ensureNotifications,runNotifications}=await import('../apps/api/notifications.js');
 const {env,input,fetcher,sql}=setup();
 await ensureNotifications(env.DB);
 sql.prepare('INSERT INTO pejlo_fences(identifier,owner_uid,name,config,enabled) VALUES(?,?,?,?,1)').run('tracker-1','owner','Hjem',JSON.stringify({lat:56.55,lon:8.31,radius:50,shape:'circle'}));
 await serverConfigAPI(env,{...input,action:'activate'},fetcher);
 const calls=[];
 const fn=async(url,options)=>{
  calls.push(url);assert.equal(new URL(url).origin,input.url);assert.equal(options.headers.Authorization,'Bearer '+input.token);
  return Response.json(url.includes('/devices?')?[{id:1,uniqueId:'tracker-1',positionId:0}]:[]);
 };
 await runNotifications(env,fn);
 assert.ok(calls.length);assert.equal(sql.prepare('SELECT errors FROM pejlo_runs').get().errors,0);
});
