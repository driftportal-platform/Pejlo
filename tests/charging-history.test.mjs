import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chargingHistory} from '../packages/shared/charging-history.js';
import {routeAnalysis} from '../packages/shared/history.js';
import {activityGps} from '../packages/shared/activity.js';
import {gpsPoint} from '../apps/api/gps.js';

const start=Date.parse('2026-11-24T00:00:00Z');
const point=(minute,charging,lat=56.5)=>({lat,lon:8.3,timestamp:start+minute*60000,charging});

test('charging fixes are excluded for animals, never inferred from full battery or unknown power',()=>{
 const points=[point(0,true),point(1,false),{...point(2,null),battery:100},point(3,undefined)];
 const original=structuredClone(points);
 for(const type of ['cat','dog','horse','animal']){
  const result=chargingHistory(points,type);
  assert.equal(result.excluded,1);assert.deepEqual(result.points.map(p=>p.timestamp),points.slice(1).map(p=>p.timestamp));
 }
 for(const type of ['car','bicycle','object','unknown'])assert.deepEqual(chargingHistory(points,type),{points,excluded:0});
 assert.deepEqual(points,original,'diagnostic/raw data must remain intact');
});

test('charging interrupts routes and activity even when its GPS report was unusable',()=>{
 const points=[point(0,false),point(2,false,56.5002),point(6,false,56.501),point(8,false,56.5012)];
 const filtered=chargingHistory(points,'cat',[point(4,true)]);
 const route=routeAnalysis(filtered.points),activity=activityGps(filtered.points,'cat',start+86400000).days[0];
 assert.equal(route.segments.length,2);assert.equal(route.gaps[0].reason,'charging');assert.equal(activity.observedMinutes,4);
 assert.ok(route.meters>40&&route.meters<50,'only the two short moving intervals count');
 assert.ok(activity.km>0.04&&activity.km<0.05);assert.equal(activity.quietMinutes,0);
 assert.equal(filtered.excluded,0,'an already unusable GPS report is not counted twice');
});

test('overnight charging leaves no pet route and unplugged fixes resume without a bridge',()=>{
 const night=[point(0,true),point(120,true,56.5002),point(360,true,56.4998)];
 const morning=[point(364,false),point(366,false,56.5003)];
 assert.deepEqual(chargingHistory(night,'cat').points,[]);
 const result=chargingHistory([...night,...morning],'cat');
 assert.equal(result.excluded,3);assert.equal(result.points[0].breakBefore,true);
 assert.equal(routeAnalysis(result.points).points.length,2);
 assert.equal(activityGps(result.points,'cat',start+86400000).days[0].observedMinutes,2);
});

test('historical charging state comes only from the fix charge attribute',()=>{
 const raw={valid:true,latitude:56.5,longitude:8.3,fixTime:new Date(start).toISOString(),attributes:{batteryLevel:100}};
 assert.equal(gpsPoint(raw).charging,null);
 assert.equal(gpsPoint({...raw,attributes:{charge:false,batteryLevel:100}}).charging,false);
 assert.equal(gpsPoint({...raw,attributes:{charge:true,batteryLevel:100}}).charging,true);
 assert.equal(gpsPoint({...raw,attributes:{charge:'true'}}).charging,null);
});
