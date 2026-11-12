import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI,point,codeHash} from '../apps/api/worker.js';
const identifier='080608317309';
function database(owner='owner-uid'){
 const gps=new Map(),requests=new Map();const rows=new Map([[identifier,{identifier,name:'Pejlo',code_hash:'test-hash',owner_uid:owner}]]);
 return {rows,prepare(sql){let args=[];return {bind(...values){args=values;return this;},async all(){return {results:[...rows.values()].filter(r=>r.owner_uid===args[0]).map(({identifier,name})=>({identifier,name}))};},async first(){
 if(sql.includes('pejlo_gps_filter')){if(sql.startsWith('SELECT'))return {state:gps.get(args[0]+args[1])};if(sql.startsWith('UPDATE')){const k=args[1]+args[2];if(gps.get(k)!==args[3])return null;gps.set(k,args[0]);return {identifier:args[1]};}}
 if(sql.startsWith('INSERT INTO pejlo_tracker_actions')){
  const key=args[0]+args[1];if(requests.get(key)>args[3])return null;
  requests.set(key,args[2]);return {identifier:args[0]};
 }
 if(sql.startsWith('INSERT INTO pejlo_position_requests')){
  if(requests.get(args[0])>args[2])return null;
  requests.set(args[0],args[1]);return {identifier:args[0]};
 }
 if(sql.includes('SELECT profile'))return null;
 if(sql.startsWith('SELECT owner_uid'))return {owner_uid:rows.get(args[0])?.owner_uid};
 if(sql.startsWith('SELECT m.'))return args[1]==='viewer-uid'?{identifier:args[0],role:'viewer'}:null;
 const row=rows.get(sql.startsWith('UPDATE')?args[1]:args[0]);
 if(sql.startsWith('UPDATE')){if(!row||row.code_hash!==args[2]||(row.owner_uid!==null&&row.owner_uid!==args[3]))return null;row.owner_uid=args[0];return {identifier:row.identifier,name:row.name};}
 return row&&(!sql.includes('AND owner_uid')||row.owner_uid===args[1])?{identifier:row.identifier}:null;
 },async run(){if(sql.startsWith('INSERT OR IGNORE INTO pejlo_gps_filter')){const k=args[0]+args[1];if(!gps.has(k))gps.set(k,'{}');return {success:true};}if(sql.startsWith('UPDATE pejlo_tracker_actions')){if(requests.get(args[0]+args[1])===args[2])requests.set(args[0]+args[1],0);return {success:true};}if(sql.startsWith('UPDATE pejlo_position_requests')){if(requests.get(args[0])===args[1])requests.set(args[0],0);return {success:true};}if(sql.startsWith('CREATE')||sql.startsWith('ALTER'))return {success:true};if(rows.has(args[0]))throw new Error();rows.set(args[0],{identifier:args[0],name:args[1],code_hash:args[2],owner_uid:null});return {success:true};}};}};
}
const env={DB:database(),TRACCAR_ADMIN_UID:'owner-uid',TRACCAR_TOKEN:'server-secret'};
const position={id:42,deviceId:7,valid:true,latitude:56.55,longitude:8.31,fixTime:new Date().toISOString(),attributes:{batteryLevel:55,secret:'never expose'}};
function fixture({uid='owner-uid',verified=true,lookupStatus=200,positionValue=position,history=true,status='offline',commandTypes=[{type:'positionSingle'}],commandStatus=200}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('accounts:lookup'))return Response.json({users:[{localId:uid,emailVerified:verified}]},{status:lookupStatus});
  assert.equal(options.headers.Authorization,'Bearer server-secret');
  if(url.includes('/api/devices?'))return Response.json([{id:99,uniqueId:'other'},{id:7,uniqueId:identifier,positionId:42,name:'Pejlo',status,lastUpdate:new Date(Date.parse(position.fixTime)+1000).toISOString(),phone:'private'}]);
  if(url.includes('/api/commands/types?'))return Response.json(commandTypes);
  if(url.endsWith('/api/commands/send'))return Response.json({}, {status:commandStatus});
  if(url.includes('/api/positions?'))return Response.json([positionValue]);
  if(url.includes('/api/reports/route?'))return Response.json(history?[position,{...position,deviceId:99}]:{}, {status:history?200:500});
  throw new Error('Unexpected request');
 };
 return {calls,fetcher};
}
const req=(options={})=>new Request('https://pejlo.example/api/tracker?identifier='+identifier,{headers:{Authorization:'Bearer firebase-id-token'},...options});
test('unauthenticated and cross-origin callers cannot reach upstreams',async()=>{
 const f=fixture();assert.equal((await handleAPI(req({headers:{}}),env,f.fetcher)).status,401);
 assert.equal((await handleAPI(req({headers:{Authorization:'Bearer t',Origin:'https://other.example'}}),env,f.fetcher)).status,403);assert.equal(f.calls.length,0);
});
test('invalid, unverified and other users never receive tracker data',async()=>{
 for(const options of [{uid:'someone-else'},{verified:false},{lookupStatus:400}]){
  const f=fixture(options),r=await handleAPI(req(),env,f.fetcher);assert.ok([401,403].includes(r.status));assert.equal(f.calls.length,1);assert.equal((await r.text()).includes('server-secret'),false);
 }
});
test('missing registry setup fails closed and never contacts Traccar',async()=>{
 const f=fixture();const r=await handleAPI(req(),{...env,DB:null},f.fetcher);assert.equal(r.status,503);assert.equal(f.calls.length,1);
});
test('only configured device and sanitized valid points are returned; offline is preserved',async()=>{
 const f=fixture(),r=await handleAPI(req(),env,f.fetcher),d=await r.json();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(d.device.status,'offline');assert.equal(d.position.battery,55);assert.equal(d.device.lastContact,Date.parse(position.fixTime)+1000);assert.equal(d.position.timestamp,Date.parse(position.fixTime));assert.equal(d.route.length,1);assert.equal(d.device.identifier,'080608317309');assert.equal(JSON.stringify(d).includes('private'),false);assert.equal(JSON.stringify(d).includes('server-secret'),false);assert.equal(JSON.stringify(d).includes('never expose'),false);
});
test('an invalid latest fix preserves the last trusted position with its original time',async()=>{
 const localEnv={...env,DB:database()};
 const first=fixture({history:false});
 const good=await (await handleAPI(req(),localEnv,first.fetcher)).json();
 assert.equal(good.position.timestamp,Date.parse(position.fixTime));
 const invalid=fixture({positionValue:{...position,valid:false},history:false});
 const result=await (await handleAPI(req(),localEnv,invalid.fetcher)).json();
 assert.deepEqual(result.position,good.position);
 assert.equal(result.gpsUncertain,true);
});
test('battery and charge are reported independently of a future GPS fix',async()=>{
 const localEnv={...env,DB:database()};
 const serverTime=new Date().toISOString();
 const future={...position,serverTime,fixTime:new Date(Date.now()+8*3600000).toISOString(),attributes:{batteryLevel:100,charge:true,secret:'never expose'}};
 const f=fixture({positionValue:future,history:false});
 const result=await (await handleAPI(req(),localEnv,f.fetcher)).json();
 assert.equal(result.position,null);
 assert.deepEqual(result.telemetry,{battery:100,charging:true,receivedAt:Date.parse(serverTime),gpsClockAhead:true});
 const absent=fixture({positionValue:{...future,attributes:{batteryLevel:101,charge:'true'}},history:false});
 const unknown=await (await handleAPI(req(),localEnv,absent.fetcher)).json();
 assert.equal(unknown.telemetry.battery,null);
 assert.equal(unknown.telemetry.charging,null);
});
test('invalid GPS stays absent and report failure does not fabricate a route',async()=>{
 const f=fixture({positionValue:{...position,valid:false},history:false});const d=await(await handleAPI(req(),{...env,DB:database()},f.fetcher)).json();assert.equal(d.position,null);assert.deepEqual(d.route,[]);assert.equal(d.historyAvailable,false);
 for(const p of [{...position,latitude:'56.5'},{...position,longitude:181},{...position,fixTime:'bad'},{...position,fixTime:new Date(Date.now()+3600000).toISOString()}])assert.equal(point(p),null);
});
test('method and route are constrained, external server override fails closed',async()=>{
 const f=fixture();assert.equal((await handleAPI(req({method:'POST'}),env,f.fetcher)).status,405);
 assert.equal((await handleAPI(new Request('https://pejlo.example/api/admin'),env,f.fetcher)).status,404);
 assert.equal((await handleAPI(req(),{...env,TRACCAR_URL:'http://other.example'},f.fetcher)).status,503);
 assert.equal(f.calls.length,1);
});

const post=(path,value)=>new Request('https://pejlo.example/api/'+path,{method:'POST',headers:{Authorization:'Bearer firebase-token','Content-Type':'application/json'},body:JSON.stringify(value)});
test('position request sends only one fixed data command despite concurrent clicks',async()=>{
 const f=fixture({status:'online'}),localEnv={...env,DB:database()};
 const send=()=>handleAPI(post('tracker/position',{identifier,deviceId:99,type:'rebootDevice',textChannel:true}),localEnv,f.fetcher);
 const responses=await Promise.all([send(),send()]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,429]);
 assert.equal((await responses.find(r=>r.ok).json()).status,'sent');
 const sends=f.calls.filter(c=>c.url.endsWith('/api/commands/send'));
 assert.equal(sends.length,1);
 assert.deepEqual(JSON.parse(sends[0].options.body),{deviceId:7,type:'positionSingle',textChannel:false,attributes:{noQueue:true}});
 assert.ok(f.calls.some(c=>c.url.endsWith('/api/commands/types?deviceId=7&textChannel=false')));
});
test('position request never sends for viewers, offline trackers or unsupported protocols',async()=>{
 for(const [options,status] of [[{uid:'viewer-uid'},403],[{},409],[{status:'online',commandTypes:[]},409]]){
  const f=fixture(options),response=await handleAPI(post('tracker/position',{identifier}),{...env,DB:database()},f.fetcher);
  assert.equal(response.status,status);
  assert.ok(f.calls.every(c=>!c.url.endsWith('/api/commands/send')));
 }
});
test('queued and failed commands are distinguished from sent commands',async()=>{
 for(const [commandStatus,status] of [[202,200],[500,502]]){
  const f=fixture({status:'online',commandStatus}),response=await handleAPI(post('tracker/position',{identifier}),{...env,DB:database()},f.fetcher);
  assert.equal(response.status,status);
  if(response.ok)assert.equal((await response.json()).status,'queued');
 }
});
test('claim requires correct code and atomically prevents another user taking the tracker',async()=>{
 const DB=database(null),code='0123456789ABCDEF0123456789ABCDEF';DB.rows.get(identifier).code_hash=await codeHash(code);
 const first=fixture(),other=fixture({uid:'another-user'});
 let r=await handleAPI(post('trackers/claim',{identifier,code:'WRONGCODEWRONGCODE'}),{...env,DB},first.fetcher);assert.equal(r.status,400);assert.equal(DB.rows.get(identifier).owner_uid,null);
 r=await handleAPI(post('trackers/claim',{identifier,code}),{...env,DB},first.fetcher);assert.equal(r.status,200);
 r=await handleAPI(post('trackers/claim',{identifier,code}),{...env,DB},other.fetcher);assert.equal(r.status,400);assert.equal(DB.rows.get(identifier).owner_uid,'owner-uid');
 assert.equal(first.calls.length,2);assert.equal(other.calls.length,1);
});
test('list exposes only owned identifiers and never pairing hashes',async()=>{
 const f=fixture({uid:'another-user'});const d=await(await handleAPI(new Request('https://pejlo.example/api/trackers',{headers:{Authorization:'Bearer token'}}),env,f.fetcher)).json();assert.deepEqual(d.trackers,[]);assert.equal(d.isAdmin,false);assert.equal(f.calls.length,1);
});
test('only administrator can provision and existing bindings cannot be overwritten',async()=>{
 const f=fixture({uid:'another-user'});assert.equal((await handleAPI(post('admin/trackers',{identifier,name:'Tracker'}),env,f.fetcher)).status,403);assert.equal(f.calls.length,1);
 const admin=fixture();assert.equal((await handleAPI(post('admin/trackers',{identifier,name:'Tracker'}),env,admin.fetcher)).status,409);assert.equal(admin.calls.length,1);
});
test('admin provisioning creates device and returns a one-time code while storing only its hash',async()=>{
 const DB=database(),calls=[],id='new-tracker-123';
 const fetcher=async(url,options)=>{
  calls.push(url);
  if(url.includes('accounts:lookup'))return Response.json({users:[{localId:'owner-uid',emailVerified:true}]});
  if(options.method==='POST'){const value=JSON.parse(options.body);assert.equal(value.uniqueId,id);return Response.json({id:123,...value});}
  return Response.json([]);
 };
 const response=await handleAPI(post('admin/trackers',{identifier:id,name:'Ny tracker'}),{...env,DB},fetcher),result=await response.json();
 assert.equal(response.status,201);assert.match(result.code,/^[A-F0-9]{32}$/);assert.equal(DB.rows.get(id).code_hash,await codeHash(result.code));assert.equal(DB.rows.get(id).owner_uid,null);assert.equal(JSON.stringify(DB.rows.get(id)).includes(result.code),false);assert.equal(calls.length,3);
});
test('Cloudflare-compatible redirect mode is used for Google and Traccar',async()=>{
 const f=fixture(),calls=[];
 const workersFetch=async(url,options)=>{if(options.redirect==='error')throw new TypeError('Unsupported redirect mode');assert.equal(options.redirect,'manual');calls.push(url);return f.fetcher(url,options);};
 const response=await handleAPI(req(),env,workersFetch);assert.equal(response.status,200);assert.equal(calls.length,4);
});
test('Google and Traccar redirects fail closed without forwarding credentials',async()=>{
 for(const provider of ['google','traccar']){
  const f=fixture(),calls=[];
  const fetcher=async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');
   if(provider==='google'||!url.includes('accounts:lookup'))return new Response(null,{status:302,headers:{Location:'https://other.example/collect'}});
   return f.fetcher(url,options);
  };
  const response=await handleAPI(req(),env,fetcher);assert.equal(response.status,provider==='google'?503:502);assert.equal(calls.length,provider==='google'?1:2);assert.ok(calls.every(url=>!url.startsWith('https://other.example')));assert.equal((await response.text()).includes('server-secret'),false);
 }
});


test('tracker actions are owner-only, capability-gated, rate-limited, and use server commands',async()=>{
 const configured={...env,DB:database(),PEJLO_TRACKER_ACTIONS:JSON.stringify({[identifier]:{find:'7e82027e'}})};
 const post=action=>new Request('https://pejlo.example/api/tracker/action',{method:'POST',headers:{Authorization:'Bearer user-token'},
  body:JSON.stringify({identifier,action,data:'aabb'})});
 const owner=fixture({status:'online',commandTypes:[{type:'custom'}]});
 const viewer=fixture({uid:'viewer-uid',status:'online',commandTypes:[{type:'custom'}]});
 assert.equal((await handleAPI(post('find'),configured,viewer.fetcher)).status,403);
 assert.equal((await handleAPI(post('sound'),configured,owner.fetcher)).status,409);
 const result=await handleAPI(post('find'),configured,owner.fetcher);
 assert.equal(result.status,200);
 const session=await result.json();
 assert.equal(session.until-session.startedAt,600000);
 assert.equal((await handleAPI(post('find'),configured,owner.fetcher)).status,429);
 const sends=owner.calls.filter(call=>call.url.endsWith('/api/commands/send'));
 assert.equal(sends.length,1);
 assert.deepEqual(JSON.parse(sends[0].options.body),{deviceId:7,type:'custom',textChannel:false,attributes:{data:'7e82027e',noQueue:true}});
 const read=await (await handleAPI(req(),configured,owner.fetcher)).json();
 assert.deepEqual(read.actions,{find:true,sound:false});
 assert.doesNotMatch(JSON.stringify(read),/7e82027e/);
});

test('a command Traccar rejects releases the rate limit at once; a queued one keeps it',async()=>{
 const post=(path,value)=>new Request('https://pejlo.example/api/'+path,{method:'POST',headers:{Authorization:'Bearer firebase-token','Content-Type':'application/json'},body:JSON.stringify(value)});
 // position request
 const db=database(),local={...env,DB:db};
 assert.equal((await handleAPI(post('tracker/position',{identifier}),local,fixture({status:'online',commandStatus:400}).fetcher)).status,502);
 assert.equal((await handleAPI(post('tracker/position',{identifier}),local,fixture({status:'online'}).fetcher)).status,200);
 assert.equal((await handleAPI(post('tracker/position',{identifier}),local,fixture({status:'online'}).fetcher)).status,429);
 // find / sound
 const actions=JSON.stringify({[identifier]:{find:'7e82027e',sound:'aabb'}}),action=(which)=>post('tracker/action',{identifier,action:which});
 const adb=database(),owner={...env,DB:adb,PEJLO_TRACKER_ACTIONS:actions},types=[{type:'custom'}];
 assert.equal((await handleAPI(action('find'),owner,fixture({status:'online',commandTypes:types,commandStatus:400}).fetcher)).status,502);
 assert.equal((await handleAPI(action('find'),owner,fixture({status:'online',commandTypes:types}).fetcher)).status,200);
 assert.equal((await handleAPI(action('find'),owner,fixture({status:'online',commandTypes:types}).fetcher)).status,429);
 assert.equal((await handleAPI(action('sound'),owner,fixture({status:'online',commandTypes:types,commandStatus:202}).fetcher)).status,502);
 assert.equal((await handleAPI(action('sound'),owner,fixture({status:'online',commandTypes:types}).fetcher)).status,429,'a queued command may still run: keep the limit');
});


test('timeouts and server errors keep tracker commands from being sent twice',async()=>{
 const options={status:'online',commandTypes:[{type:'positionSingle'},{type:'custom'}]};
 const trackerActions=JSON.stringify({[identifier]:{find:'7e82027e',sound:'aabb'}});
 for(const action of ['position','find','sound']){
  for(const failure of ['timeout','server']){
   const local={...env,DB:database(),PEJLO_TRACKER_ACTIONS:trackerActions};
   const path=action==='position'?'position':'action';
   const payload=action==='position'?{identifier}:{identifier,action};
   const request=()=>new Request('https://pejlo.example/api/tracker/'+path,{
    method:'POST',headers:{Authorization:'Bearer firebase-token'},body:JSON.stringify(payload)
   });
   const source=fixture({...options,commandStatus:500});
   const fetcher=(url,init)=>{
    if(failure==='timeout'&&url.endsWith('/api/commands/send'))throw new DOMException('Timed out','TimeoutError');
    return source.fetcher(url,init);
   };
   assert.equal((await handleAPI(request(),local,fetcher)).status,502);
   const retry=fixture(options);
   assert.equal((await handleAPI(request(),local,retry.fetcher)).status,429);
   assert.equal(retry.calls.some(call=>call.url.endsWith('/api/commands/send')),false);
  }
 }
});
