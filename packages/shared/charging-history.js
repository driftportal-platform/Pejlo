import {types} from './profiles.js';

// Charging is a property of each historical fix, never of today's latest
// telemetry. Animal trackers charging off the animal must not create pet trips.
// Raw fixes remain in Traccar and can be requested explicitly for inspection.
export function chargingHistory(points,type,reports=points){
 if(!Object.hasOwn(types,type)||types[type].category!=='dyr')return {points,excluded:0};
 const charging=reports.filter(p=>p?.charging===true&&Number.isFinite(p.timestamp)).map(p=>p.timestamp).sort((a,b)=>a-b);
 const result=[];let excluded=0,at=0,last=-Infinity;
 for(const p of points){
  if(p.charging===true){excluded++;continue;}
  while(at<charging.length&&charging[at]<=last)at++;
  const interrupted=at<charging.length&&charging[at]<=p.timestamp;
  result.push(interrupted?{...p,breakBefore:true}:p);last=p.timestamp;
 }
 return {points:result,excluded};
}
