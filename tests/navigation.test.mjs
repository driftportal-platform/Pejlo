import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distance,bearing,relativeBearing,directionName,searchZoom} from '../packages/shared/geo.js';
import {cleanProfile} from '../dist/src/features/profiles.js';
import {loadState,saveState} from '../dist/src/features/storage.js';
test('search bearings handle cardinal directions, the date line and handset rotation',()=>{
  const start={lat:0,lon:0};
  assert.equal(bearing(start,{lat:1,lon:0}),0);
  assert.equal(bearing(start,{lat:0,lon:1}),90);
  assert.equal(bearing(start,{lat:-1,lon:0}),180);
  assert.equal(bearing(start,{lat:0,lon:-1}),270);
  assert.equal(bearing({lat:0,lon:179},{lat:0,lon:-179}),90);
  assert.equal(relativeBearing(10,350),20);
  assert.equal(directionName(359),'nord');
  assert.ok(distance({lat:56.55,lon:8.31},{lat:56.55,lon:8.32})<700);
});
test('zoom increases on approach and stays conservative with poor location accuracy',()=>{
  assert.ok(searchZoom(30,8)>searchZoom(600,8));
  assert.ok(searchZoom(8,150)<searchZoom(8,8));
});
test('profile validation rejects unknown types, invalid homes and prototype keys',()=>{
  const valid={id:'a',name:'Cykel',type:'bicycle',home:{lat:56,lon:8,radius:100}};
  assert.equal(cleanProfile(valid).type,'bicycle');
  assert.equal(cleanProfile({...valid,type:'__proto__'}),null);
  assert.equal(cleanProfile({...valid,home:{lat:91,lon:8,radius:100}}),null);
});
test('profiles preserve separate homes through saving and reloading; invalid active ID recovers',()=>{
  let value;
  globalThis.localStorage={getItem:()=>value??null,setItem:(_,v)=>value=v};
  const profiles=[{id:'cat',name:'Loui',type:'cat',home:{lat:56,lon:8,radius:100}},{id:'bike',name:'Min cykel',type:'bicycle',home:{lat:57,lon:9,radius:200}}];
  assert.equal(saveState({profiles,activeId:'bike',mapKey:''}),true);
  assert.equal(loadState().profiles[1].home.lat,57);
  assert.equal(loadState().activeId,'bike');
  value=JSON.stringify({profiles,activeId:'missing'});
  assert.equal(loadState().activeId,'cat');
  value='{broken';assert.equal(loadState().profiles.length,0);
  delete globalThis.localStorage;
});
