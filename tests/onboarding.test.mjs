import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadState,saveState} from '../dist/src/features/storage.js';
const home={lat:56.5495,lon:8.311,radius:100};
const sample={id:'loui-demo',name:'Loui',type:'cat',deviceLabel:'Q8_H · endnu ikke forbundet',home};
function storage(){const m=new Map();globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};return m;}
test('first visit has no profiles or selected animal',()=>{storage();assert.deepEqual(loadState(),{profiles:[],activeId:null,mapKey:''});});
test('migration removes untouched auto sample and preserves user profiles and map key',()=>{
 const m=storage();m.set('find-loui-v02',JSON.stringify({profiles:[sample,{id:'my-cat',name:'Loui',type:'cat',home,deviceLabel:'Min tracker'}],activeId:sample.id,mapKey:'public-key'}));
 const s=loadState();assert.deepEqual(s.profiles.map(p=>p.id),['my-cat']);assert.equal(s.activeId,'my-cat');assert.equal(s.mapKey,'public-key');
 saveState(s);s.profiles=[];s.activeId=null;saveState(s);assert.equal(loadState().profiles.length,0);
});
test('migration preserves a renamed, retyped or otherwise customized original profile',()=>{
 for(const changes of [{name:'Min kat'},{type:'dog'},{home:{...home,radius:200}},{deviceLabel:'Mit halsbånd'}]){
 const m=storage();m.set('find-loui-v02',JSON.stringify({profiles:[{...sample,...changes}],activeId:sample.id}));
 assert.equal(loadState().profiles.length,1);
 }
});
test('saved empty state remains empty through reload',()=>{storage();saveState({profiles:[],activeId:null,mapKey:''});assert.equal(loadState().activeId,null);assert.deepEqual(loadState().profiles,[]);});
