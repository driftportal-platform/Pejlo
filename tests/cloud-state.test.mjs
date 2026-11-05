import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudState} from '../dist/src/features/cloud-state.js';
import {emptyState} from '../dist/src/features/account-state.js';
function fixture(){
 const listeners=[];let remote=null;const seen=[];let busy=false,saved=0;
 const api={ref:uid=>`users/${uid}/private/state`,listen:(ref,ok,error)=>{listeners.push({ref,ok,error});return ()=>{};},transaction:async(ref,update)=>{remote=update(remote);}};
 const handlers={state:s=>seen.push(s),connection:()=>{},error:()=>{},busy:b=>busy=b,saved:()=>saved++};
 return {api,handlers,listeners,seen,get remote(){return remote;},set remote(v){remote=v;},get busy(){return busy;},get saved(){return saved;}};
}
test('unverified accounts cannot open private profile storage',()=>{const f=fixture();assert.throws(()=>createCloudState(f.api).open({uid:'a',emailVerified:false},f.handlers));assert.equal(f.listeners.length,0);});
test('server data must arrive before saving, and first save starts at revision 1',async()=>{
 const f=fixture(),cloud=createCloudState(f.api),save=cloud.open({uid:'a',emailVerified:true},f.handlers);
 await assert.rejects(save(emptyState()));f.listeners[0].ok({fromCache:false,pending:false,data:null});await save(emptyState());
 assert.equal(f.remote.revision,1);assert.equal(f.saved,1);assert.equal(f.busy,false);
});
test('a revision conflict keeps remote data and reports failure instead of overwriting it',async()=>{
 const f=fixture(),save=createCloudState(f.api).open({uid:'a',emailVerified:true},f.handlers);
 f.listeners[0].ok({data:{...emptyState(),revision:2},fromCache:false,pending:false});f.remote={...emptyState(),revision:3};
 await assert.rejects(save(emptyState()),{code:'pejlo/conflict'});assert.equal(f.remote.revision,3);assert.equal(f.saved,0);assert.equal(f.busy,false);
});
test('switching users ignores old listener events and prevents old save operations',async()=>{
 const f=fixture(),cloud=createCloudState(f.api),oldSave=cloud.open({uid:'a',emailVerified:true},f.handlers);
 f.listeners[0].ok({fromCache:false,pending:false,data:null});cloud.open({uid:'b',emailVerified:true},f.handlers);
 const count=f.seen.length;f.listeners[0].ok({fromCache:false,pending:false,data:{...emptyState(),mapKey:'account-a-only'}});
 assert.equal(f.seen.length,count);assert.equal(f.listeners[1].ref,'users/b/private/state');await assert.rejects(oldSave(emptyState()));
});
test('cached and uncommitted snapshots never unlock another account',()=>{
 const f=fixture();createCloudState(f.api).open({uid:'a',emailVerified:true},f.handlers);
 f.listeners[0].ok({fromCache:true,pending:false,data:{mapKey:'cached'}});f.listeners[0].ok({fromCache:false,pending:true,data:{mapKey:'pending'}});
 assert.equal(f.seen.length,0);
});
