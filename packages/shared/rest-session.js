import {distance,validPoint} from './geo.js';
import {gpsSpeedLimit} from './gps-filter.js';
// Three new fixes, GPS speed plus displacement, coherent travel and no long gap.
// A lone jump, a jump back, an old upload or a heartbeat cannot stop manual rest.
export function restMovement(samples,started,type,now=Date.now()){
 const maxSpeed=gpsSpeedLimit(type),rows=[...samples].filter(p=>p&&Number.isFinite(p.timestamp)&&p.timestamp>started&&p.timestamp<=now&&now-p.timestamp<=5*60000).sort((a,b)=>a.timestamp-b.timestamp);
 const unique=new Map();for(const p of rows){const old=unique.get(p.timestamp);unique.set(p.timestamp,old&&JSON.stringify(old)!==JSON.stringify(p)?{timestamp:p.timestamp,valid:false}:p);}
 let run=[];
 for(const p of unique.values()){
  if(p.valid!==true||!validPoint(p)||(p.lat===0&&p.lon===0)||p.charging!==false||p.speedKph<2||!Number.isFinite(p.speedKph)||p.speedKph/3.6>maxSpeed||!Number.isInteger(p.satellites)||p.satellites<6||(Number.isFinite(p.accuracy)&&p.accuracy>25)){run=[];continue;}
  const last=run.at(-1);
  if(last&&(p.timestamp-last.timestamp>150000||distance(last,p)/( (p.timestamp-last.timestamp)/1000)>maxSpeed))run=[];
  run.push(p);if(run.length>3)run.shift();
  if(run.length===3){const [a,b,c]=run,ab=distance(a,b),bc=distance(b,c),net=distance(a,c);
   if(c.timestamp-a.timestamp>=20000&&ab>=10&&bc>=10&&net>=35&&ab+bc<=net*1.8)return {at:a.timestamp,confirmedAt:c.timestamp,fixes:3};
  }
 }
 return null;
}
