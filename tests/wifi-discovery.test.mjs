import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWifiScan,mergeWifiSelection,createWifiDiscovery} from '../dist/src/features/wifi-discovery.js';
const now=1800000000000,mac='28:BD:89:05:5C:10',other='28:BD:89:05:5C:47';
const reading=(at=now,points=[{mac,rssi:-49}])=>({device:{status:'online'},telemetry:{wifiMeasuredAt:at,wifiAccessPoints:points}});
test('discovery accumulates radio addresses across rooms without counting repeated polls',()=>{
 const scan=createWifiScan();assert.equal(scan.observe(reading(),now),true);
 assert.equal(scan.observe(reading(),now+15000),false);
 assert.equal(scan.observe(reading(now+30000,[{mac,rssi:-70},{mac:other,rssi:-55}]),now+30000),true);
 const result=scan.snapshot();assert.equal(result.scans,2);assert.equal(result.points.length,2);
 assert.deepEqual(result.points[0],{mac,rssi:-70,strongest:-49,seen:2,lastAt:now+30000});
});
test('stale, future, offline, missing and out-of-order Wi-Fi are not collected',()=>{
 const scan=createWifiScan();
 for(const value of [reading(now-120001),reading(now+60000),reading(null),{...reading(),device:{status:'offline'}},reading(now,[])])assert.equal(scan.observe(value,now),false);
 assert.equal(scan.snapshot().points.length,0);
 scan.observe(reading(now+30000),now+30000);
 assert.equal(scan.observe(reading(),now+30000),false);assert.equal(scan.snapshot().scans,1);
});
test('discovery is bounded and returns independent copies without saving neighbours to a profile',()=>{
 const scan=createWifiScan(),profile={macs:[mac],samples:[]};
 for(let i=0;i<5;i++)scan.observe(reading(now+i*1000,Array.from({length:16},(_,j)=>({mac:'02:00:00:00:'+i.toString(16).padStart(2,'0')+':'+j.toString(16).padStart(2,'0'),rssi:-50}))),now+i*1000);
 assert.equal(scan.snapshot().points.length,64);const copy=scan.snapshot();copy.points[0].rssi=0;
 assert.equal(scan.snapshot().points[0].rssi,-50);assert.deepEqual(profile,{macs:[mac],samples:[]});assert.equal(createWifiScan().snapshot().points.length,0);
});
test('only explicitly selected points are merged, preserving existing addresses and enforcing limits',()=>{
 assert.deepEqual(mergeWifiSelection([mac],[other,mac.toLowerCase()]),[mac,other]);
 assert.throws(()=>mergeWifiSelection([mac],[]),/Vælg/);assert.throws(()=>mergeWifiSelection(['invalid'],[other]),/Kontrollér/);
 const many=Array.from({length:17},(_,i)=>'02:00:00:00:00:'+i.toString(16).padStart(2,'0'));
 assert.throws(()=>mergeWifiSelection([],many),/16/);
});

// A minimal DOM exercises the actual controller and its profile/permission boundary.
function fixture(){
 class Element{
  constructor(){this.children=[];this.handlers={};this.disabled=false;this.hidden=false;}
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(type,fn){this.handlers[type]=fn;}
 }
 const elements=Object.fromEntries(['start','stop','use','status','list'].map(id=>['[data-wifi-'+id+']',new Element()]));
 const root={querySelector:id=>elements[id],ownerDocument:{createElement:()=>new Element()}};
 let profile={id:'loui',trackerId:'one'},value=reading(),editable=true,ready=true,field=[],used=null;
 const ui=createWifiDiscovery({root,selected:()=>profile,data:()=>value,canEdit:()=>editable,ready:()=>ready,readMacs:()=>field,onUse:macs=>{used=macs;field=macs;},notice:()=>{},now:()=>now});
 const el=id=>elements['[data-wifi-'+id+']'];
 return {ui,el,setProfile:p=>profile=p,setData:v=>value=v,setEditable:v=>editable=v,setReady:v=>ready=v,used:()=>used};
}
test('controller leaves new networks unchecked and requires an explicit selection before use',()=>{
 const f=fixture();f.ui.update();f.el('start').onclick();
 const checkbox=f.el('list').children[0].children[0];assert.equal(checkbox.checked,false);assert.equal(f.el('use').disabled,true);
 f.el('use').onclick();assert.equal(f.used(),null);
 checkbox.checked=true;checkbox.handlers.change();f.el('use').onclick();assert.deepEqual(f.used(),[mac]);
 assert.match(f.el('status').textContent,/Gem profil/);
});
test('profile changes, logout and permission changes cannot reuse collected candidates',()=>{
 const f=fixture();f.ui.update();f.el('start').onclick();assert.equal(f.el('list').children.length,1);
 f.setProfile({id:'other',trackerId:'two'});f.ui.update();assert.equal(f.el('list').children.length,0);assert.equal(f.el('use').hidden,true);
 f.setEditable(false);f.ui.update();f.el('start').onclick();assert.equal(f.el('start').disabled,true);assert.equal(f.el('list').children.length,0);
 f.setProfile(null);f.ui.update();assert.equal(f.el('start').disabled,true);assert.match(f.el('status').textContent,/tracker/);
});
test('stopping preserves choices and drafts that change tracker stop collection',()=>{
 const f=fixture();f.ui.update();f.el('start').onclick();f.el('stop').onclick();
 f.setData(reading(now,[{mac:other,rssi:-20}]));f.ui.update();assert.equal(f.el('list').children.length,1);
 f.setReady(false);f.ui.update();assert.equal(f.el('use').disabled,true);assert.equal(f.el('start').disabled,true);
 f.ui.clear();f.ui.update();assert.equal(f.el('list').children.length,0);
});
