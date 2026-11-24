import {activityDates} from './activity.js';
import {danishDate,historyRange} from './history.js';
export const REST_WINDOW=15*60000;
// A conservative estimate between actual received reports, never extrapolated
// indefinitely from a last heartbeat and never interpreted as measured sleep.
export function estimateRest(events,from,to,now=Date.now()){
 const range=historyRange(from,to,now),days=new Map(activityDates(from,to,now).map(day=>[day,{day,estimatedRestHours:null,estimatedRestMinutes:0}]));
 let worn=false,charging=null,chargeUntil=0,sleepUntil=0,last=null;
 const priority={wear_off:0,wear_on:0,position_report:1,query_report:1,heartbeat:2,sleep_report:3};
 const ordered=events.filter(e=>Number.isFinite(e.at)&&e.at<=range.to&&Object.hasOwn(priority,e.kind)).sort((a,b)=>a.at-b.at||priority[a.kind]-priority[b.kind]);
 function add(start,end){
  let at=Math.max(start,range.from);end=Math.min(end,range.to);
  while(at<end){const day=danishDate(at),boundary=Math.min(end,historyRange(day,day,now).to);if(boundary<=at)break;const row=days.get(day);if(row)row.estimatedRestMinutes+=(boundary-at)/60000;at=boundary;}
 }
 for(const e of ordered){
  if(last!==null&&e.at-last<=REST_WINDOW&&worn&&charging===false)add(last,Math.min(e.at,sleepUntil,chargeUntil));
  if(e.kind==='wear_off'){worn=false;sleepUntil=0;}
  else if(e.kind==='wear_on'){worn=true;sleepUntil=0;}
  else{
   if(e.charging===true){charging=true;chargeUntil=0;sleepUntil=0;}
   else if(e.charging===false){charging=false;chargeUntil=e.at+REST_WINDOW;}
   if(e.motion===true)sleepUntil=0;
   if(e.kind==='sleep_report'&&worn&&charging===false&&e.at<=chargeUntil)sleepUntil=e.at+REST_WINDOW;
  }
  last=e.at;
 }
 return [...days.values()].map(row=>({...row,estimatedRestHours:row.estimatedRestMinutes>0?Math.round(row.estimatedRestMinutes/60*100)/100:null}));
}
