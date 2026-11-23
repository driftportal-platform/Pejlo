import {test} from 'node:test';
import assert from 'node:assert/strict';
import {batteryHistory} from '../packages/shared/battery-history.js';
import {getBatteryHistory} from '../apps/api/battery-history.js';
const from=1800000000000,to=from+86400000;
const point=(id,h,level)=>({id,deviceId:1,fixTime:new Date(from+h*3600000).toISOString(),attributes:{batteryLevel:level}});
test('counts stored positions once and keeps measured battery values without filling missing hours',()=>{
 const a=point(1,0,80),b=point(2,2,75),result=batteryHistory([b,a,a,{...point(3,3,70),deviceId:2},point(4,25,60),point(5,4,null)],from,to,1);
 assert.equal(result.count,3);assert.equal(result.buckets[1].battery,null);assert.equal(result.first.level,80);assert.equal(result.last.level,75);assert.equal(result.buckets[2].battery,75);assert.equal(result.buckets[4].count,1);
});
test('unknown or invalid battery values do not become zero and charging remains explicit',()=>{
 const p=point(1,1,0);p.attributes.charge=true;
 const r=batteryHistory([p,point(2,2,101),point(3,3,'80')],from,to,1);
 assert.equal(r.first.level,0);assert.equal(r.buckets[1].charging,true);assert.equal(r.measurements.length,1);assert.equal(r.buckets[2].battery,null);
});
test('seven-day summaries preserve all seven buckets without interpolation',()=>{
 const r=batteryHistory([point(1,0,80),point(2,120,60)],from,from+7*86400000,1,7);assert.equal(r.buckets.length,7);assert.equal(r.buckets[5].battery,60);assert.equal(r.buckets[1].battery,null);
});
test('history reads Traccar records and source-scoped interval events without sending commands',async()=>{
 const calls=[],binds=[];const env={TRACCAR_SOURCE:'source',DB:{prepare(sql){return {bind(...args){binds.push(args);return this;},async run(){},async all(){return {results:[{at:to-100,seconds:60,status:'sent'}]};}};}}};
 const r=await getBatteryHistory({env,identifier:'080608317309',device:{id:1},now:to,traccar:async path=>{calls.push(path);return [point(1,2,75)];}});
 assert.equal(r.count,1);assert.equal(r.changes[0].seconds,60);assert.ok(calls[0].startsWith('/api/reports/route?'));assert.equal(binds[0][0],'source:080608317309');
 await assert.rejects(()=>getBatteryHistory({env,identifier:'x',device:{id:1},days:365,traccar:async()=>[]}),{status:400});
});
