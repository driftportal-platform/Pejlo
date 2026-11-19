import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signalStatus} from '../apps/web/src/features/signal-bar.js';
const now=Date.now();
const data=(telemetry={},status='online')=>({device:{status},telemetry:{satellites:5,rssi:13,rssiMax:31,receivedAt:now,...telemetry}});
test('signal bars distinguish mobile reception from satellite count and GPS clock failures',()=>{
 const s=signalStatus(data(),now);assert.equal(s.mobile.level,2);assert.equal(s.mobile.value,'Middel');assert.equal(s.satellite.value,'5 satellitter');
 const clock=signalStatus(data({satellites:12,gpsClockAhead:true}),now);assert.equal(clock.satellite.tone,'warning');assert.match(clock.satellite.note,/Tidsfejl/);assert.equal(clock.mobile.value,'Middel');
});
test('old, undated, future and offline reports cannot show fresh coloured bars',()=>{
 for(const d of [data({receivedAt:now-300001}),data({receivedAt:null}),data({receivedAt:now+60001}),data({},'offline')]){
  const s=signalStatus(d,now);assert.equal(s.mobile.tone,'unknown');assert.equal(s.mobile.level,0);assert.equal(s.satellite.tone,'unknown');
 }
});
test('missing signal and unsupported RSSI scales never become strong reception',()=>{
 for(const t of [{rssi:null},{rssi:99},{rssiMax:null},{rssi:-1},{rssi:'31'}])assert.equal(signalStatus(data(t),now).mobile.tone,'unknown');
 const absent=signalStatus(null,now);assert.equal(absent.satellite.value,'Ikke oplyst');
 const zero=signalStatus(data({rssi:0,satellites:0}),now);assert.equal(zero.mobile.level,0);assert.equal(zero.mobile.tone,'poor');assert.equal(zero.satellite.value,'0 satellitter');
 const strong=signalStatus(data({rssi:31}),now);assert.equal(strong.mobile.level,4);
});
