import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrackerClient} from '../apps/web/src/features/tracker.js';
const flush=()=>new Promise(r=>setImmediate(r));
test('logout discards late tracker responses',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);let updates=0;
 const client=createTrackerClient({fetcher:()=>pending,setTimer:()=>1,clearTimer:()=>{}});
 client.start({getIdToken:async()=> 'id-token'},'tracker-id',()=>updates++,()=>updates++);await flush();client.stop();resolve(Response.json({source:'traccar',device:{identifier:'abc'}}));await flush();assert.equal(updates,0);
});
test('API errors remain errors and do not become example positions',async()=>{
 let message='';const client=createTrackerClient({fetcher:async()=>Response.json({error:'Ingen tracker til kontoen'},{status:403}),setTimer:()=>1,clearTimer:()=>{}});
 client.start({getIdToken:async()=> 'id-token'},'tracker-id',()=>assert.fail(),error=>message=error);await flush();assert.equal(message,'Ingen tracker til kontoen');client.stop();
});
test('profile normalization preserves its linked tracker across devices',async()=>{
 const {newProfile,cleanProfile}=await import('../dist/src/features/profiles.js');const profile=newProfile('Min cykel','bicycle');profile.trackerId='080608317309';assert.equal(cleanProfile(profile).trackerId,'080608317309');assert.equal(cleanProfile({...profile,trackerId:null}).trackerId,'');
});
test('normal polling uses 15 seconds with lightweight fixes between full routes every minute',async()=>{
 const now=Date.now;let clock=100000,timerId=0;const pending=new Map(),urls=[],updates=[];
 Date.now=()=>clock;
 const client=createTrackerClient({fetcher:async url=>{urls.push(url);return Response.json({source:'traccar',device:{identifier:'abc'}});},setTimer:(callback,delay)=>{const id=++timerId;pending.set(id,{callback,delay});return id;},clearTimer:id=>pending.delete(id)});
 try{
  client.start({getIdToken:async()=> 'token'},'abc',(data,live)=>updates.push(live),error=>assert.fail(error));await flush();
  for(let i=0;i<4;i++){
   const [id,timer]=[...pending.entries()][0];assert.equal(timer.delay,15000);pending.delete(id);clock+=timer.delay;await timer.callback();
  }
  assert.deepEqual(updates,[false,true,true,true,false]);
  assert.equal(urls.filter(url=>url.includes('&live=1')).length,3);
 }finally{client.stop();Date.now=now;}
});
test('Find polls every 10 seconds until its faster polling window ends',async()=>{
 const now=Date.now;let clock=100000,timerId=0;const pending=new Map();Date.now=()=>clock;
 const client=createTrackerClient({fetcher:async()=>Response.json({source:'traccar',device:{identifier:'abc'}}),setTimer:(callback,delay)=>{const id=++timerId;pending.set(id,{callback,delay});return id;},clearTimer:id=>pending.delete(id)});
 try{
  client.start({getIdToken:async()=> 'token'},'abc',()=>{},error=>assert.fail(error),clock+10000);await flush();
  const [id,timer]=[...pending.entries()][0];assert.equal(timer.delay,10000);pending.delete(id);clock+=10000;await timer.callback();
  assert.equal([...pending.values()][0].delay,15000);
 }finally{client.stop();Date.now=now;}
});

test('visibility suspends polling and a route can be refreshed on demand',async()=>{
 const visibility=new EventTarget();
 visibility.hidden=false;
 let timerId=0;
 const timers=new Map(),urls=[];
 const client=createTrackerClient({
  visibility,routeInterval:()=>300000,
  fetcher:async url=>{urls.push(url);return Response.json({source:'traccar',device:{identifier:'abc'}});},
  setTimer:(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;},
  clearTimer:id=>timers.delete(id)
 });
 try{
  client.start({getIdToken:async()=> 'token'},'abc',()=>{},assert.fail);
  await flush();
  visibility.hidden=true;
  visibility.dispatchEvent(new Event('visibilitychange'));
  assert.equal(timers.size,0);
  assert.equal(await client.refreshRoute(),false);
  visibility.hidden=false;
  visibility.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(await client.refreshRoute(),true);
  assert.deepEqual(urls.map(url=>url.includes('&live=1')),[false,true,false]);
 }finally{client.stop();}
});

test('polling backs off after errors and resets after success',async()=>{
 let timerId=0,attempt=0;
 const timers=new Map();
 const client=createTrackerClient({
  fetcher:async()=>++attempt<3
   ?Response.json({error:'Midler­tidig fejl'},{status:503})
   :Response.json({source:'traccar',device:{identifier:'abc'}}),
  setTimer:(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;},
  clearTimer:id=>timers.delete(id)
 });
 try{
  client.start({getIdToken:async()=> 'token'},'abc',()=>{},()=>{});
  await flush();
  for(const delay of [30000,60000]){
   const [timer]=timers.values();
   assert.equal(timer.delay,delay);
   await timer.callback();
  }
  assert.equal([...timers.values()][0].delay,15000);
 }finally{client.stop();}
});
