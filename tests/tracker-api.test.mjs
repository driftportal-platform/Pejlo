import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI,point,codeHash} from '../apps/api/worker.js';
const identifier='080608317309';
function database(owner='owner-uid'){
 const rows=new Map([[identifier,{identifier,name:'Pejlo',code_hash:'test-hash',owner_uid:owner}]]);
 return {rows,prepare(sql){let args=[];return {bind(...values){args=values;return this;},async all(){return {results:[...rows.values()].filter(r=>r.owner_uid===args[0]).map(({identifier,name})=>({identifier,name}))};},async first(){
 const row=rows.get(sql.startsWith('UPDATE')?args[1]:args[0]);
 if(sql.startsWith('UPDATE')){if(!row||row.code_hash!==args[2]||(row.owner_uid!==null&&row.owner_uid!==args[3]))return null;row.owner_uid=args[0];return {identifier:row.identifier,name:row.name};}
 return row&&(!sql.includes('AND owner_uid')||row.owner_uid===args[1])?{identifier:row.identifier}:null;
 },async run(){if(rows.has(args[0]))throw new Error();rows.set(args[0],{identifier:args[0],name:args[1],code_hash:args[2],owner_uid:null});return {success:true};}};}};
}
const env={DB:database(),TRACCAR_ADMIN_UID:'owner-uid',TRACCAR_TOKEN:'server-secret'};
const position={id:42,deviceId:7,valid:true,latitude:56.55,longitude:8.31,fixTime:new Date().toISOString(),attributes:{batteryLevel:55,secret:'never expose'}};
function fixture({uid='owner-uid',verified=true,lookupStatus=200,positionValue=position,history=true}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('accounts:lookup'))return Response.json({users:[{localId:uid,emailVerified:verified}]},{status:lookupStatus});
  assert.equal(options.headers.Authorization,'Bearer server-secret');
  if(url.includes('/api/devices?'))return Response.json([{id:99,uniqueId:'other'},{id:7,uniqueId:identifier,positionId:42,name:'Pejlo',status:'offline',phone:'private'}]);
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
 const f=fixture(),r=await handleAPI(req(),env,f.fetcher),d=await r.json();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(d.device.status,'offline');assert.equal(d.position.battery,55);assert.equal(d.route.length,1);assert.equal(d.device.identifier,'080608317309');assert.equal(JSON.stringify(d).includes('private'),false);assert.equal(JSON.stringify(d).includes('server-secret'),false);assert.equal(JSON.stringify(d).includes('never expose'),false);
});
test('invalid GPS stays absent and report failure does not fabricate a route',async()=>{
 const f=fixture({positionValue:{...position,valid:false},history:false});const d=await(await handleAPI(req(),env,f.fetcher)).json();assert.equal(d.position,null);assert.deepEqual(d.route,[]);assert.equal(d.historyAvailable,false);
 for(const p of [{...position,latitude:'56.5'},{...position,longitude:181},{...position,fixTime:'bad'},{...position,fixTime:new Date(Date.now()+3600000).toISOString()}])assert.equal(point(p),null);
});
test('method and route are constrained, external server override fails closed',async()=>{
 const f=fixture();assert.equal((await handleAPI(req({method:'POST'}),env,f.fetcher)).status,405);
 assert.equal((await handleAPI(new Request('https://pejlo.example/api/admin'),env,f.fetcher)).status,404);
 assert.equal((await handleAPI(req(),{...env,TRACCAR_URL:'http://other.example'},f.fetcher)).status,503);
 assert.equal(f.calls.length,1);
});

const post=(path,value)=>new Request('https://pejlo.example/api/'+path,{method:'POST',headers:{Authorization:'Bearer firebase-token','Content-Type':'application/json'},body:JSON.stringify(value)});
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
