import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWifiSetup,wifiSetupQuality} from '../packages/shared/wifi-setup.js';
import {createWifiSetupGuide} from '../dist/src/features/wifi-setup.js';
import {wifiCardText,rememberWifi,wifiDisplay} from '../packages/shared/wifi-history.js';
import {homeWifiStatus,cleanWifiConfig} from '../packages/shared/home-wifi.js';

const at=1800000000000,mac='28:BD:89:05:5C:10',other='28:BD:89:05:5C:47';
const reading=(time,rssi=-40,points=[{mac,rssi}])=>({device:{status:'online'},telemetry:{wifiMeasuredAt:time,wifiAccessPoints:points}});
const collect=(s,start,label='inside')=>{for(let i=0;i<3;i++)s.observe(reading(start+i*30000,label==='inside'?-40:-80),start+i*30000);};

test('known home points are reused and three distinct scans finish each labelled step',()=>{
 const s=createWifiSetup({macs:[mac]},at);collect(s,at);
 assert.equal(s.snapshot().phase,'inside-ready');assert.equal(s.configuration().samples.length,3);
 s.startOutside(at+70000);collect(s,at+90000,'outside');assert.equal(s.snapshot().phase,'done');
 assert.equal(wifiSetupQuality(s.configuration()),'distinct');assert.equal(s.configuration().samples.length,6);
});
test('cached, repeated, rapid, offline, old, future, missing and unselected scans never advance training',()=>{
 const s=createWifiSetup({macs:[mac]},at);
 for(const data of [reading(at-1),reading(at+60000),reading(at-130000),reading(null),{...reading(at),device:{status:'offline'}},reading(at,-40,[]),reading(at,-40,[{mac:other,rssi:-20}])])assert.equal(s.observe(data,at),false);
 s.observe(reading(at),at);assert.equal(s.observe(reading(at),at+15000),false);assert.equal(s.observe(reading(at+19999),at+19999),false);assert.equal(s.snapshot().inside.length,1);
});
test('outside starts only after the user marks the move, excluding indoor scans',()=>{
 const s=createWifiSetup({macs:[mac]},at);assert.throws(()=>s.startOutside(at));collect(s,at);
 assert.equal(s.observe(reading(at+70000),at+70000),false);
 s.startOutside(at+90000);assert.equal(s.observe(reading(at+60000),at+90000),false);assert.equal(s.snapshot().outside.length,0);
 collect(s,at+90000,'outside');assert.equal(s.snapshot().outside.length,3);
});
test('new radio addresses remain a draft until explicitly confirmed, and suggestions require repetition',()=>{
 const s=createWifiSetup({},at);
 s.observe(reading(at,-40,[{mac,rssi:-40},{mac:other,rssi:-20}]),at);
 s.observe(reading(at+30000),at+30000);s.observe(reading(at+60000),at+60000);
 assert.equal(s.snapshot().phase,'choose');assert.throws(()=>s.configuration());
 assert.equal(s.candidates().find(p=>p.mac===mac).recommended,true);assert.equal(s.candidates().find(p=>p.mac===other).recommended,false);
 assert.throws(()=>s.choose(['02:00:00:00:00:02']));assert.throws(()=>s.choose([]));
 s.choose([mac]);assert.deepEqual(s.configuration().macs,[mac]);assert.equal(s.configuration().samples.length,3);
});
test('a point seen in only one indoor scan needs more matching scans after confirmation',()=>{
 const s=createWifiSetup({},at);
 s.observe(reading(at,-40,[{mac,rssi:-40},{mac:other,rssi:-60}]),at);
 s.observe(reading(at+30000),at+30000);s.observe(reading(at+60000),at+60000);s.choose([other]);
 assert.equal(s.snapshot().phase,'inside');assert.equal(s.snapshot().inside.length,1);
 s.observe(reading(at+90000,-60,[{mac:other,rssi:-60}]),at+90000);s.observe(reading(at+120000,-60,[{mac:other,rssi:-60}]),at+120000);
 assert.equal(s.configuration().samples.length,3);
});
test('training snapshots are independent and indistinguishable patterns remain uncertain',()=>{
 const s=createWifiSetup({macs:[mac]},at);collect(s,at);s.snapshot().inside[0].points[0].rssi=0;
 assert.equal(s.snapshot().inside[0].points[0].rssi,-40);s.startOutside(at+90000);collect(s,at+90000);
 assert.equal(wifiSetupQuality(s.configuration()),'uncertain');assert.equal(wifiSetupQuality({macs:[mac]}),'uncertain');
});
test('saved indoor data allows resuming outdoors without repeating setup',()=>{
 const s=createWifiSetup({macs:[mac]},at);collect(s,at);
 const resumed=createWifiSetup(s.configuration(),at+90000,true);assert.equal(resumed.snapshot().phase,'outside');assert.equal(resumed.snapshot().inside.length,3);
 assert.throws(()=>createWifiSetup({},at,true));
});

function fixture(config={macs:[mac]}){
 class Element{
  constructor(){this.children=[];this.hidden=false;this.disabled=false;this.checked=false;}
  append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];}
  querySelectorAll(tag){return this.children.flatMap(e=>[...(tag==='input'&&e.tag==='input'?[e]:[]),...e.querySelectorAll(tag)]);}
 }
 const fields=Object.fromEntries(['start','resume','outside','cancel','confirm','choices','retry','progress','status','list'].map(k=>['[data-wifi-setup-'+k+']',new Element()]));
 const doc={hidden:false,createElement:tag=>Object.assign(new Element(),{tag})},root={querySelector:k=>fields[k],ownerDocument:doc};
 let profile={id:'loui',trackerId:'one',homeWifi:cleanWifiConfig(config)},value=reading(at-1000),clock=at,editable=true,ready=true,scope=0,fail=false,defer=null;
 const calls=[],messages=[];
 const ui=createWifiSetupGuide({root,selected:()=>profile,data:()=>value,canEdit:()=>editable,ready:()=>ready,scope:()=>scope,now:()=>clock,notice:s=>messages.push(s),save:async(next,expected)=>{
  calls.push({next,expected});if(fail)throw Error('Gemning fejlede');if(defer)await defer;profile.homeWifi=next;
 }});
 const el=k=>fields['[data-wifi-setup-'+k+']'];
 const set=(time,rssi=-40,points)=>{clock=time;value=reading(time,rssi,points);ui.update();};
 return {ui,el,set,calls,messages,doc,profile:()=>profile,setProfile:v=>profile=v,setEditable:v=>editable=v,setReady:v=>ready=v,setScope:v=>scope=v,setClock:v=>clock=v,setFail:v=>fail=v,setDefer:v=>defer=v};
}
const flush=()=>new Promise(r=>setImmediate(r));
async function inside(f){f.ui.update();f.el('start').onclick();for(const time of [at+1000,at+31000,at+61000]){f.set(time);await flush();}}

test('guide automatically saves each step once, with no per-reading clicks',async()=>{
 const f=fixture();await inside(f);assert.equal(f.calls.length,1);assert.equal(f.el('outside').hidden,false);
 f.ui.update();f.ui.update();assert.equal(f.calls.length,1);
 f.setClock(at+62000);f.el('outside').onclick();assert.equal(f.calls.length,1);
 for(const time of [at+91000,at+121000,at+151000]){f.set(time,-80);await flush();}
 assert.equal(f.calls.length,2);assert.equal(f.calls[1].next.samples.length,6);assert.match(f.el('status').textContent,/gemt/);
});
test('suggested new points are saved only after one explicit confirmation',async()=>{
 const f=fixture({});await inside(f);assert.equal(f.calls.length,0);assert.equal(f.el('choices').hidden,false);
 assert.equal(f.el('list').querySelectorAll('input')[0].checked,true);
 f.el('confirm').onclick();await flush();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].next.macs,[mac]);
});
test('save errors retain scans for explicit retry and never cause an automatic request loop',async()=>{
 const f=fixture();f.setFail(true);await inside(f);assert.equal(f.calls.length,1);assert.equal(f.el('retry').hidden,false);
 for(let n=0;n<8;n++)f.ui.update();await flush();assert.equal(f.calls.length,1);
 f.setFail(false);f.el('retry').onclick();await flush();assert.equal(f.calls.length,2);assert.equal(f.el('outside').hidden,false);
});
test('profile, account, permission and changed configuration discard the old draft',async()=>{
 for(const change of ['profile','account','permission','wifi']){
  const f=fixture();f.ui.update();f.el('start').onclick();f.set(at+1000);
  if(change==='profile')f.setProfile({id:'other',trackerId:'two',homeWifi:{macs:[mac]}});
  if(change==='account')f.setScope(1);
  if(change==='permission')f.setEditable(false);
  if(change==='wifi')f.profile().homeWifi={macs:[other]};
  f.set(at+31000);f.set(at+61000);await flush();assert.equal(f.calls.length,0,change);
 }
});
test('hidden pages and unsaved profile edits pause learning, and cancellation keeps saved indoor data',async()=>{
 const f=fixture();f.ui.update();f.el('start').onclick();f.doc.hidden=true;f.set(at+1000);f.doc.hidden=false;f.setReady(false);f.set(at+31000);assert.equal(f.calls.length,0);
 f.setReady(true);for(const time of [at+61000,at+91000,at+121000]){f.set(time);await flush();}
 assert.equal(f.calls.length,1);f.el('cancel').onclick();assert.equal(f.profile().homeWifi.samples.length,3);assert.equal(f.el('resume').hidden,false);
});
test('guide waits honestly without scans and stops collecting after fifteen minutes',async()=>{
 const f=fixture();f.ui.update();f.el('start').onclick();assert.match(f.el('status').textContent,/Wi-Fi-scanning/);assert.equal(f.calls.length,0);
 f.set(at+901000);await flush();assert.equal(f.calls.length,0);assert.match(f.el('status').textContent,/15 minutter/);
});
test('late save completion cannot restart a cancelled or switched guide',async()=>{
 const f=fixture();let resolve;f.setDefer(new Promise(r=>resolve=r));await inside(f);assert.equal(f.calls.length,1);
 f.ui.clear();f.setProfile({id:'other',trackerId:'two',homeWifi:{macs:[mac]}});f.ui.update();resolve();await flush();
 assert.equal(f.el('outside').hidden,true);assert.equal(f.messages.length,0);
});
test('Wi-Fi card separates saved setup from a missing fresh scan and keeps old readings dated',()=>{
 const now=Date.now(),status=homeWifiStatus({device:{status:'online'},telemetry:{}},{macs:[mac]},now);
 assert.match(wifiCardText(status,()=> '10 min. siden').note,/1 punkt gemt/);assert.match(wifiCardText(status,()=> '').value,/scanning/);
 assert.match(wifiCardText(homeWifiStatus(null,{},now),()=> '').value,/Opsæt/);
 const seenOther=homeWifiStatus(reading(now,-30,[{mac:other,rssi:-30}]),{macs:[mac]},now);assert.match(wifiCardText(seenOther,()=> '').value,/ikke set/);
 const history=rememberWifi(null,{wifiAccessPoints:[{mac,rssi:-50}],wifiMeasuredAt:now-600000},now);
 assert.match(wifiCardText(wifiDisplay(status,history),()=> '10 min. siden').note,/10 min/);
 assert.equal(wifiDisplay(status,history).kind,'unknown');
});
