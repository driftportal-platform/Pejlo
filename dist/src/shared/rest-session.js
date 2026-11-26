import {distance,validPoint} from './geo.js';
import {gpsSpeedLimit} from './gps-filter.js';
import {gpsMovingPair} from './gps-motion.js';
export const REST_STOP_DISTANCES=[10,20,30,40,50];
export const restStopDistance=value=>REST_STOP_DISTANCES.includes(value)?value:40;
// Speed-supported travel with a confirmed arrival, or sustained displacement.
// A lone jump, a jump back, an old upload or a heartbeat cannot stop manual rest.
export function restMovement(samples,started,type,now=Date.now(),historical=false,distanceMeters=40){
 const threshold=restStopDistance(distanceMeters),legMinimum=Math.max(3,threshold/4);
 const maxSpeed=gpsSpeedLimit(type),rows=[...samples].filter(p=>p&&Number.isFinite(p.timestamp)&&p.timestamp>started&&p.timestamp<=now&&(historical||now-p.timestamp<=15*60000)).sort((a,b)=>a.timestamp-b.timestamp);
 const unique=new Map();for(const p of rows){const old=unique.get(p.timestamp);unique.set(p.timestamp,old&&JSON.stringify(old)!==JSON.stringify(p)?{timestamp:p.timestamp,valid:false}:p);}
 let run=[];
 for(const p of unique.values()){
  if(p.valid!==true||!validPoint(p)||(p.lat===0&&p.lon===0)||p.charging!==false||p.speedKph<0||!Number.isFinite(p.speedKph)||p.speedKph/3.6>maxSpeed||!Number.isInteger(p.satellites)||p.satellites<6||(Number.isFinite(p.accuracy)&&p.accuracy>25)){run=[];continue;}
  const last=run.at(-1);
  if(last&&(p.timestamp-last.timestamp>300000||distance(last,p)/( (p.timestamp-last.timestamp)/1000)>maxSpeed))run=[];
  run.push(p);if(run.length>4)run.shift();
  if(!historical&&now-p.timestamp>300000)continue;
  if(run.length>=2){const pair=gpsMovingPair(run.at(-2),p,type,threshold);if(pair)return {at:pair.at,confirmedAt:pair.confirmedAt,fixes:2};}
  if(run.length>=3){const [a,b,c]=run.slice(-3),ab=distance(a,b),bc=distance(b,c),net=distance(a,c);
   if([a,b,c].every(q=>q.speedKph>=2)&&c.timestamp-a.timestamp>=20000&&ab>=legMinimum&&bc>=legMinimum&&net>=threshold&&ab+bc<=net*1.8)return {at:a.timestamp,confirmedAt:c.timestamp,fixes:3};
   // A walk can end between two reports. Two moving fixes at least a minute
   // apart, followed by an independent fix near the arrival, still show travel.
   // Keep the 40 m displacement and all GPS quality checks; one speed spike or
   // a jump straight back cannot close a resting session.
   if(a.speedKph>=2&&b.speedKph>=2&&c.speedKph<=1&&b.timestamp-a.timestamp>=60000&&c.timestamp-b.timestamp>=5000&&c.timestamp-b.timestamp<=120000&&ab>=threshold&&bc<=Math.min(15,threshold*.3)&&net>=threshold)return {at:a.timestamp,confirmedAt:c.timestamp,fixes:3};
  }
  // Point speed is instantaneous: a walking animal may have stopped at each fix.
  // Require a stronger four-fix spatial proof rather than inventing a speed.
  if(run.length===4){const [a,b,c,d]=run,legs=[distance(a,b),distance(b,c),distance(c,d)],net=distance(a,d);
   if(d.timestamp-a.timestamp>=60000&&d.timestamp-a.timestamp<=15*60000&&legs.filter(v=>v>=legMinimum).length>=2&&net>=threshold&&Math.max(...legs)<=net*.7&&legs.reduce((s,v)=>s+v,0)<=net*1.8)return {at:a.timestamp,confirmedAt:d.timestamp,fixes:4};
  }
 }
 return null;
}
