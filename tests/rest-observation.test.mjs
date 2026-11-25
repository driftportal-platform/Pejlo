import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quietGps,petActivityStatus,wornQuietIntervals} from '../packages/shared/rest-observation.js';
import {restObservation} from '../apps/api/rest-observation.js';
import {estimateRest} from '../packages/shared/rest-estimate.js';
const start=Date.parse('2026-11-25T07:30:22Z'),id='080608317309';
// Actual 08:30–08:48 Loui fixes: stationary speed with about 16 m GPS drift.
const coordinates=[[56.556615,8.329767],[56.556614,8.329768],[56.556611,8.329785],[56.556602,8.329769],[56.556541,8.329666],[56.556530,8.329640],[56.556507,8.329603],[56.556508,8.329623],[56.556506,8.329631],[56.556506,8.329636]];
const samples=coordinates.map(([lat,lon],i)=>({lat,lon,timestamp:start+i*120000,valid:true,charging:false,speedKph:0,satellites:15,accuracy:null}));
const now=samples.at(-1).timestamp+1000;
const profile={type:'cat',trackerId:id,attachment:{state:'worn',since:start-60000,trackerId:id}};
const data={source:'traccar',device:{identifier:id,status:'online'},restSamples:samples};

test('actual Loui fixes give possible rest after 15 minutes, never measured sleep',()=>{
 assert.deepEqual(quietGps(samples,now),[[start,samples.at(-1).timestamp]]);
 assert.equal(petActivityStatus(data,profile,now).state,'rest');
 assert.match(petActivityStatus(data,profile,now).detail,/ikke målt søvn/);
 assert.equal(petActivityStatus({...data,restSamples:samples.slice(0,8)},profile,start+14*60000).state,'unknown');
});
test('gaps, charging, unknown charging, bad fixes and slow cumulative drift break quiet runs',()=>{
 for(const patch of [{valid:false},{charging:true},{charging:null},{accuracy:80},{satellites:0},{speedKph:4},{breakBefore:true}]){
  const points=samples.map((p,i)=>i===4?{...p,...patch}:p);
  assert.deepEqual(quietGps(points,now),[],JSON.stringify(patch));
 }
 const gap=samples.map((p,i)=>({...p,timestamp:p.timestamp+(i>=4?600000:0)}));assert.deepEqual(quietGps(gap,now+600000),[]);
 const drifting=samples.map((p,i)=>({...p,lat:56.5+i*.00008,lon:8.3}));assert.deepEqual(quietGps(drifting,now),[]);
 const conflict=[...samples,{...samples[4],charging:true}];assert.deepEqual(quietGps(conflict,now),[]);
});
test('old, offline, removed, newly worn and other-profile data do not imply current rest',()=>{
 for(const [d,p,t] of [[data,profile,now+6*60000],[{...data,device:{identifier:id,status:'offline'}},profile,now],[data,{...profile,attachment:null},now],[data,{...profile,attachment:{...profile.attachment,since:start+10*60000}},now],[data,{...profile,trackerId:'another'},now],[{...data,source:'demo'},profile,now]])assert.equal(petActivityStatus(d,p,t).state,'unknown');
});
test('a fresh sleep report may support possible rest with recent non-charging and wear evidence',()=>{
 const d={...data,restSamples:[],reportState:{lastSleepAt:now-1000},telemetry:{receivedAt:now-2000,charging:false}};
 assert.equal(petActivityStatus(d,profile,now).state,'rest');
 for(const changed of [{...d,telemetry:{receivedAt:now-2000,charging:true}},{...d,telemetry:{receivedAt:now-20*60000,charging:false}},{...d,reportState:{lastSleepAt:now-20*60000}},{...d,reportState:{lastSleepAt:now-1000,lastPositionReportAt:now}}])assert.equal(petActivityStatus(changed,profile,now).state,'unknown');
});
test('movement needs two credible speed reports and displacement, not reporting alone or GPS jumps',()=>{
 const moving=samples.slice(-2).map((p,i)=>({...p,lat:56.5+i*.0004,lon:8.3,speedKph:3}));
 assert.equal(petActivityStatus({...data,restSamples:moving},profile,now).state,'moving');
 for(const points of [[moving[1]],moving.map(p=>({...p,speedKph:0})),moving.map((p,i)=>({...p,lat:56+i})),moving.map(p=>({...p,lat:56.5}))])assert.equal(petActivityStatus({...data,restSamples:points},profile,now).state,'unknown');
});
test('wear boundaries and GPS plus dvale intervals are unioned, preserving manual totals elsewhere',()=>{
 const intervals=quietGps(samples,now),wear=[{at:start-60000,worn:1}];
 assert.deepEqual(wornQuietIntervals(intervals,wear,now),intervals);
 assert.deepEqual(wornQuietIntervals(intervals,[{at:start+10*60000,worn:1}],now),[]);
 const events=[{at:start,kind:'wear_on'},{at:start,kind:'position_report',charging:false},{at:start,kind:'sleep_report'},{at:start+10*60000,kind:'heartbeat'}];
 assert.equal(estimateRest(events,'2026-11-25','2026-11-25',now,intervals)[0].estimatedRestMinutes,18);
 const midnight=Date.parse('2026-11-24T23:00:00Z'),rows=estimateRest([],'2026-11-24','2026-11-25',now,[[midnight-10*60000,midnight+10*60000]]);
 assert.deepEqual(rows.map(r=>r.estimatedRestMinutes),[10,10]);
});
test('raw samples use decoded fix time, convert knots and retain invalid fixes as barriers',()=>{
 const raw={fixTime:new Date(start).toISOString(),serverTime:new Date(start+1000).toISOString(),latitude:56.5,longitude:8.3,valid:true,speed:1,attributes:{charge:false,sat:15}};
 const p=restObservation(raw);assert.equal(p.speedKph,1.852);assert.equal(p.timestamp,start);assert.equal(p.valid,true);
 assert.equal(restObservation({...raw,fixTime:new Date(start+8*3600000).toISOString()}).valid,false);
 assert.equal(restObservation({...raw,outdated:true}).valid,false);
 assert.equal(restObservation({...raw,attributes:{approximate:true,charge:false}}).valid,false);
 assert.equal(restObservation({...raw,speed:undefined}).speedKph,null);
 const old=restObservation({...raw,serverTime:new Date(now).toISOString()});assert.equal(old.timestamp,start,'late uploads never freshen the fix');
});
