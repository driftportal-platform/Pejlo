import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rememberWifi,wifiDisplay} from '../packages/shared/wifi-history.js';
import {homeWifiStatus} from '../packages/shared/home-wifi.js';
import {createServerStatus} from '../apps/web/src/features/server-status.js';
import {trustedGps} from '../apps/api/gps.js';
const mac='28:BD:89:05:5C:10';
test('server persists Wi-Fi independently of GPS and returns it after a later request without Wi-Fi',async()=>{
 let stored='{}';const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async run(){return {success:true};},async first(){if(sql.startsWith('SELECT'))return {state:stored};if(sql.startsWith('UPDATE')){stored=args[0];return {identifier:'one'};}}};}};
 const at=Date.now()-600000,report={wifiMeasuredAt:at,wifiAccessPoints:[{mac,rssi:-50}]};
 const a=await trustedGps(db,'one','owner',[],'cat',null,null,'source',report);
 const b=await trustedGps(db,'one','owner',[],'cat',null,null,'source',{});
 assert.deepEqual(b.lastWifi,a.lastWifi);assert.equal(b.lastWifi.at,at);assert.equal(b.lastWifi.points[0].mac,mac);
});
test('missing Wi-Fi never erases previous measurement or renews its time',()=>{
 const now=Date.now(),old=rememberWifi(null,{wifiAccessPoints:[{mac,rssi:-50,password:'secret'}],wifiMeasuredAt:now-600000},now);
 assert.deepEqual(old,{at:now-600000,points:[{mac,rssi:-50}]});
 assert.deepEqual(rememberWifi(old,{wifiAccessPoints:[],wifiMeasuredAt:null},now),old);
 assert.deepEqual(rememberWifi(old,{wifiAccessPoints:[{mac,rssi:-30}],wifiMeasuredAt:now+60000},now),old);
 assert.deepEqual(rememberWifi(old,{wifiAccessPoints:[{mac,rssi:-30}],wifiMeasuredAt:now-700000},now),old);
});
test('history is display-only and limited to addresses selected in this profile',()=>{
 const now=Date.now(),status=homeWifiStatus({device:{status:'online'},telemetry:{}},{macs:[mac]},now),last={at:now-600000,points:[{mac,rssi:-55}]};
 const display=wifiDisplay(status,last);assert.equal(display.historical,true);assert.equal(display.fresh,false);assert.equal(display.kind,'unknown');assert.equal(display.at,last.at);
 assert.equal(wifiDisplay({...status,config:{macs:[],samples:[]}},last).points.length,0);
 assert.equal(homeWifiStatus({device:{status:'online'},telemetry:{lastWifi:last}},{macs:[mac]},now).kind,'unknown');
});
function setup(request){const element={dataset:{}},handlers={},timers=[];const doc={hidden:false,addEventListener:(n,f)=>handlers[n]=f,removeEventListener:n=>delete handlers[n]};return {element,doc,handlers,timers,client:createServerStatus({element,request,doc,setTimer:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimer:()=>{}})};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('health checks show online/offline without inspecting tracker status and repeat at 30 seconds',async()=>{
 let online=true;const s=setup(async()=>({online}));s.client.start();await tick();assert.equal(s.element.dataset.state,'online');assert.equal(s.timers[0].ms,30000);
 online=false;await s.timers[0].f();assert.equal(s.element.dataset.state,'offline');s.client.stop();
});
test('logout ignores late health results and hidden pages do not request a check',async()=>{
 let resolve,calls=0;const s=setup(()=>{calls++;return new Promise(r=>resolve=r);});s.client.start();s.client.stop();resolve({online:true});await tick();assert.equal(s.element.dataset.state,'checking');
 s.doc.hidden=true;s.client.start();assert.equal(calls,1);s.doc.hidden=false;s.handlers.visibilitychange();assert.equal(calls,2);resolve({online:true});await tick();assert.equal(s.element.dataset.state,'online');s.client.stop();
});
