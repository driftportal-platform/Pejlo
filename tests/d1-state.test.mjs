import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {accountStateAPI,legacyAccount} from '../apps/api/account-state.js';
import {ensureFamily} from '../apps/api/family.js';
import {deleteUserData} from '../apps/api/user-data.js';
import {handleAPI} from '../apps/api/worker.js';
import {newProfile} from '../packages/shared/profiles.js';
import {createD1StateAdapter} from '../dist/src/features/d1-state.js';
import {createCloudState} from '../dist/src/features/cloud-state.js';

function database(){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT)');
 const db={prepare(sql){const stmt=raw.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async first(){return stmt.get(...args)||null;},async run(){return stmt.run(...args);},async all(){return {results:stmt.all(...args)};}};},async batch(statements){raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.all());raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e;}}};
 return {raw,db};
}
const state=(profiles=[],activeId=profiles[0]?.id)=>({profiles,activeId});
const tick=()=>new Promise(r=>setImmediate(r));
test('first login imports once, backs up the old document and isolates account state',async()=>{
 const {db,raw}=database(),p=newProfile('Loui','cat');let reads=0;
 const loadLegacy=async()=>{reads++;return {...state([p]),oldExtra:'recoverable'};};
 const a=await accountStateAPI({db,uid:'a',loadLegacy});assert.equal(a.profiles[0].name,'Loui');assert.equal(a.revision,0);
 await accountStateAPI({db,uid:'a',loadLegacy});assert.equal(reads,1);
 assert.equal(JSON.parse(raw.prepare('SELECT snapshot FROM pejlo_state_imports WHERE uid=?').get('a').snapshot).oldExtra,'recoverable');
 assert.equal((await accountStateAPI({db,uid:'b'})).profiles.length,0);
 const saved=await accountStateAPI({db,uid:'a',input:{state:state([{...p,name:'Misser'}]),revision:0}});assert.equal(saved.revision,1);assert.equal(saved.profiles[0].name,'Misser');
 await assert.rejects(()=>accountStateAPI({db,uid:'a',input:{state:state([p]),revision:0}}),{status:409});
 assert.equal((await accountStateAPI({db,uid:'a'})).profiles[0].name,'Misser');
});
test('canonical linked profile wins over old Firestore copy and has no private duplicate',async()=>{
 const {db,raw}=database();await ensureFamily(db);const p={...newProfile('Loui','cat'),trackerId:'317309'};
 raw.prepare('INSERT INTO trackers VALUES(?,?)').run('317309','owner');raw.prepare('INSERT INTO pejlo_profiles VALUES(?,?,?,1)').run('317309','owner',JSON.stringify(p));
 const a=await accountStateAPI({db,uid:'owner',loadLegacy:async()=>state([{...p,name:'Old name'}])});assert.equal(a.profiles[0].name,'Loui');
 assert.equal(JSON.parse(raw.prepare('SELECT state FROM pejlo_account_state').get().state).profiles.length,0);
 await accountStateAPI({db,uid:'owner',input:{state:state([{...p,name:'Forged private copy'}]),revision:0}});
 assert.equal((await accountStateAPI({db,uid:'owner'})).profiles[0].name,'Loui');
 raw.prepare('INSERT INTO pejlo_members VALUES(?,?,?,?)').run('317309','viewer','v@test.dk','viewer');
 assert.equal((await accountStateAPI({db,uid:'viewer'})).profiles[0].name,'Loui');
 raw.prepare('DELETE FROM pejlo_members').run();assert.equal((await accountStateAPI({db,uid:'viewer'})).profiles.length,0);
 await assert.rejects(()=>accountStateAPI({db,uid:'outsider',input:{state:state([p]),revision:0}}),{status:403});
});
test('import publishes an owned linked profile only if the canonical record is absent',async()=>{
 const {db,raw}=database();const p={...newProfile('First Loui','cat'),trackerId:'317309'};raw.prepare('INSERT INTO trackers VALUES(?,?)').run('317309','a');
 const a=await accountStateAPI({db,uid:'a',loadLegacy:async()=>state([p])});assert.equal(a.profiles[0].name,p.name);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM pejlo_profiles').get().n,1);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM pejlo_fences').get().n,1);
});
test('unowned legacy tracker becomes a private unlinked profile without gaining access',async()=>{
 const {db}=database(),p={...newProfile('Old','cat'),trackerId:'other-tracker'};
 const a=await accountStateAPI({db,uid:'a',loadLegacy:async()=>state([p])});assert.equal(a.profiles[0].trackerId,'');
});
test('failed import leaves no empty D1 account to mask old profiles on retry',async()=>{
 const {db,raw}=database();await assert.rejects(()=>accountStateAPI({db,uid:'a',loadLegacy:async()=>{throw Error('offline');}}));
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM pejlo_account_state').get().n,0);
 const a=await accountStateAPI({db,uid:'a',loadLegacy:async()=>state([newProfile('Retry','dog')])});assert.equal(a.profiles[0].name,'Retry');
});
test('profile selection survives normalization of a canonical linked profile',async()=>{
 const {db,raw}=database();await ensureFamily(db);const p={...newProfile('Loui','cat'),trackerId:'317309'},other=newProfile('Bike','bicycle');
 raw.prepare('INSERT INTO trackers VALUES(?,?)').run('317309','a');raw.prepare('INSERT INTO pejlo_profiles VALUES(?,?,?,1)').run('317309','a',JSON.stringify(p));
 await accountStateAPI({db,uid:'a'});const a=await accountStateAPI({db,uid:'a',input:{state:state([other,p],p.id),revision:0}});
 assert.equal(a.activeId,p.id);assert.equal(a.profiles.length,2);
});
test('account deletion removes D1 profile state and import backup without deleting another account',async()=>{
 const {db,raw}=database();for(const uid of ['a','b'])await accountStateAPI({db,uid,loadLegacy:async()=>state([newProfile(uid,'cat')])});
 await deleteUserData(db,'a');for(const table of ['pejlo_account_state','pejlo_state_imports']){assert.equal(raw.prepare('SELECT COUNT(*) n FROM '+table+' WHERE uid=?').get('a').n,0);assert.equal(raw.prepare('SELECT COUNT(*) n FROM '+table+' WHERE uid=?').get('b').n,1);}
});
function firestore(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(firestore)}};if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,firestore(x)]))}};return typeof v==='number'?{doubleValue:v}:typeof v==='boolean'?{booleanValue:v}:{stringValue:v};}
test('Firestore REST import uses only the authenticated account token and document',async()=>{
 const old=state([newProfile('Loui','cat')]);const a=await legacyAccount({uid:'user-a',token:'firebase-id',projectId:'pejlo',fetcher:async(url,options)=>{assert.match(url,/users\/user-a\/private\/state$/);assert.equal(options.headers.Authorization,'Bearer firebase-id');assert.equal(options.redirect,'manual');return Response.json({fields:firestore(old).mapValue.fields});}});assert.equal(a.profiles[0].name,'Loui');
 for(const status of [401,403,500])await assert.rejects(()=>legacyAccount({uid:'a',projectId:'pejlo',fetcher:async()=>new Response('',{status})}),{status:503});
 assert.equal(await legacyAccount({uid:'a',projectId:'pejlo',fetcher:async()=>new Response('',{status:404})}),null);
});
test('D1 account endpoint requires verified authentication and works without Traccar credentials',async()=>{
 const {db}=database(),url='https://pejlo.test/api/account/state';let calls=0;
 const fetcher=async(url)=>{calls++;return url.includes('accounts:lookup')?Response.json({users:[{localId:'a',emailVerified:true}]}):new Response('',{status:404});};
 assert.equal((await handleAPI(new Request(url),{DB:db},fetcher)).status,401);
 const headers={Authorization:'Bearer test'};assert.equal((await handleAPI(new Request(url,{headers}),{DB:db},fetcher)).status,200);assert.equal(calls,2);
 assert.equal((await handleAPI(new Request(url,{headers}),{DB:db},fetcher)).status,200);assert.equal(calls,3,'second read skips Firestore');
});
test('D1 adapter supports conflict-safe saves, recovery from offline and cancelled sessions',async()=>{
 let remote={...state(),revision:0},offline=false;const timers=[],seen=[];let saved=0;
 const adapter=createD1StateAdapter({request:async(input)=>{if(offline)throw Error('offline');if(input)remote={...input.state,revision:input.revision+1};return remote;},setTimer:fn=>(timers.push(fn),fn),clearTimer:()=>{}});
 const cloud=createCloudState(adapter),save=cloud.open({uid:'a',emailVerified:true},{state:s=>seen.push(s),connection:()=>{},error:e=>{throw e;},busy:()=>{},saved:()=>saved++});
 await tick();const first=seen.length;await timers.at(-1)();assert.equal(seen.length,first,'unchanged polling must not reset UI drafts');
 await save(state([newProfile('Loui','cat')]));assert.equal(saved,1);assert.equal(remote.revision,1);
 remote={...state([newProfile('Remote','dog')]),revision:2};await assert.rejects(()=>save(state()),{code:'pejlo/conflict'});assert.equal(seen.at(-1).profiles[0].name,'Remote');
 offline=true;await timers.at(-1)();await assert.rejects(()=>save(state()));offline=false;await timers.at(-1)();await save(state());assert.equal(saved,2);
 cloud.close();await assert.rejects(()=>save(state()));
});
test('closing an adapter before its initial response suppresses callbacks and timers',async()=>{
 let finish,events=0,timers=0;const adapter=createD1StateAdapter({request:()=>new Promise(r=>finish=r),setTimer:()=>{timers++;},clearTimer:()=>{}});
 const stop=adapter.listen('a',()=>events++,()=>events++);stop();finish({...state(),revision:0});await tick();assert.equal(events,0);assert.equal(timers,0);
});
test('closing during the revision read prevents a delayed write from reaching the API',async()=>{
 let finish,requests=0;const adapter=createD1StateAdapter({request:async()=>{requests++;return requests===1?{...state(),revision:0}:new Promise(r=>finish=r);},setTimer:()=>0,clearTimer:()=>{}});
 const stop=adapter.listen('a',()=>{},()=>{});await tick();const saving=adapter.transaction('a',s=>s);stop();finish({...state(),revision:0});await assert.rejects(saving);assert.equal(requests,2);
});
test('hidden tabs pause account polling while first login always loads',async()=>{
 let calls=0;const timers=[];const adapter=createD1StateAdapter({request:async()=>{calls++;return {...state(),revision:0};},visible:()=>false,setTimer:fn=>(timers.push(fn),fn),clearTimer:()=>{}});
 const stop=adapter.listen('a',()=>{},()=>{});await tick();assert.equal(calls,1);await timers.at(-1)();assert.equal(calls,1);stop();
});
test('invalid profile posts cannot silently erase existing profiles',async()=>{
 const {db}=database();const p=newProfile('Loui','cat');await accountStateAPI({db,uid:'a',loadLegacy:async()=>state([p])});
 for(const profiles of [[p,p],[{id:'invalid'}]])await assert.rejects(()=>accountStateAPI({db,uid:'a',input:{state:state(profiles),revision:0}}),{status:400});
 assert.equal((await accountStateAPI({db,uid:'a'})).profiles[0].name,'Loui');
});
test('HTTP profile checks omit unchanged payloads but invalidate when canonical data changes',async()=>{
 const {db,raw}=database();await ensureFamily(db);const p={...newProfile('Loui','cat'),trackerId:'317309'};
 raw.prepare('INSERT INTO trackers VALUES(?,?)').run('317309','a');raw.prepare('INSERT INTO pejlo_profiles VALUES(?,?,?,1)').run('317309','a',JSON.stringify(p));
 const url='https://pejlo.test/api/account/state',env={DB:db},headers={Authorization:'Bearer test'},fetcher=async url=>url.includes('accounts:lookup')?Response.json({users:[{localId:'a',emailVerified:true}]}):new Response('',{status:404});
 const first=await handleAPI(new Request(url,{headers}),env,fetcher),etag=first.headers.get('ETag');assert.ok(etag);assert.equal(first.headers.get('cache-control'),'no-store');
 const same=await handleAPI(new Request(url,{headers:{...headers,'If-None-Match':etag}}),env,fetcher);assert.equal(same.status,304);assert.equal(await same.text(),'');
 raw.prepare('UPDATE pejlo_profiles SET profile=?').run(JSON.stringify({...p,name:'Misser'}));
 const changed=await handleAPI(new Request(url,{headers:{...headers,'If-None-Match':etag}}),env,fetcher);assert.equal(changed.status,200);assert.notEqual(changed.headers.get('ETag'),etag);assert.equal((await changed.json()).profiles[0].name,'Misser');
 assert.equal((await handleAPI(new Request(url,{headers:{'If-None-Match':etag}}),env,fetcher)).status,401);
});
