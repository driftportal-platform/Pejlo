import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterGps} from '../packages/shared/gps-filter.js';
import {gpsMovingPair} from '../packages/shared/gps-motion.js';
import {petActivityStatus} from '../packages/shared/rest-observation.js';
import {restMovement} from '../packages/shared/rest-session.js';
const at=Date.parse('2026-11-26T22:34:00Z');
const point=(metres,seconds,speedKph=6,extra={})=>({lat:56.5+metres/111195,lon:8.3,timestamp:at+seconds*1000,valid:true,speedKph,satellites:15,charging:false,accuracy:5,...extra});
test('a continuous walk with 200 m between good reports no longer remains pinned at home',()=>{
 const rows=[point(0,-120,0),point(0,0,0),point(200,120),point(400,240),point(600,360)];
 const r=filterGps(rows,'cat');assert.equal(r.points.length,5);assert.equal(r.state.trusted.timestamp,rows[4].timestamp);assert.equal(r.state.uncertain,false);assert.equal(r.state.provisional,false);
});
test('velocity support does not accept poor radio fixes or an implausible fast jump',()=>{
 const base=[point(0,-30,0),point(0,0,0)];
 for(const extra of [{satellites:3},{charging:null},{charging:true},{accuracy:60},{speedKph:0}]){
  const r=filterGps([...base,point(200,120,6,extra)],'cat');assert.equal(r.state.trusted.timestamp,at);assert.equal(r.state.uncertain,true);
 }
 const r=filterGps([...base,point(200,30,3.6)],'cat');assert.equal(r.state.trusted.timestamp,at);
 assert.equal(gpsMovingPair(point(0,0),point(50,10),'cat',20),null);
});
test('an old saved anchor without quality metadata recovers during a continuous walk',()=>{
 const old=point(0,0,0);delete old.speedKph;delete old.satellites;
 const initial={trusted:old,seen:old.timestamp,provisional:false,uncertain:false};
 const rows=[point(200,120),point(400,240),point(600,360)],r=filterGps(rows,'cat',initial);
 assert.equal(r.state.trusted.timestamp,rows[2].timestamp);assert.equal(r.state.uncertain,false);assert.deepEqual(r.points.map(p=>p.timestamp),[rows[1].timestamp,rows[2].timestamp]);
 const back=filterGps([rows[0],point(1,240)],'cat',initial);assert.ok(back.state.trusted.lat<point(2,240).lat);
});
test('the same good motion pair drives activity and configured rest stopping',()=>{
 const rows=[point(0,30),point(60,90)],now=at+91000;
 const profile={type:'cat',trackerId:'080608317309',attachment:{state:'worn',since:at-60000,trackerId:'080608317309'}};
 const data={source:'traccar',device:{identifier:profile.trackerId,status:'online'},restSamples:rows};
 assert.equal(petActivityStatus(data,profile,now).state,'moving');
 for(const threshold of [10,20,30,40,50])assert.equal(restMovement(rows,at,'cat',now,false,threshold).fixes,2);
 assert.equal(restMovement(rows,at+30000,'cat',now,false,40),null,'a fix before or at the manual start cannot count');
 for(const extra of [{satellites:3},{charging:null},{accuracy:80},{speedKph:0}])assert.equal(gpsMovingPair(rows[0],{...rows[1],...extra},'cat',20),null);
});
