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
