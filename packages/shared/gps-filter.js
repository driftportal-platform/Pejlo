import {distance,validPoint} from './geo.js';
export const gpsSpeedLimit=type=>({cat:12,dog:15,horse:25,animal:15,bicycle:20,car:70,object:20}[type]??20);
function isMirrored(point,reference){
 return validPoint(point)&&validPoint(reference)&&
  distance(reference,{lat:-point.lat,lon:-point.lon})<=25000&&distance(reference,point)>1000000;
}
/** Prefer a stable battery reading over the wild 0 % ↔ 90 % swings many JT808 trackers report. */
function smoothBattery(previous,candidate,uncertain){
 if(!Number.isFinite(candidate)||candidate<0||candidate>100)return previous??null;
 // Trackers frequently report 0 % while still having power, especially on weak signal.
 if(candidate===0&&previous!=null&&previous>15)return previous;
 // Large swings while the position itself is already considered uncertain are usually noise.
 if(previous!=null&&Math.abs(candidate-previous)>35&&uncertain)return previous;
 return Math.round(candidate);
}
function withBattery(point,battery){
 if(!point)return point;
 if(battery==null){
  // Do not invent a battery field when neither the point nor the filter has one.
  if(!('battery' in point)||point.battery==null)return point;
  const {battery:_,...rest}=point;return rest;
 }
 if(point.battery===battery)return point;
 return {...point,battery};
}
// State contains only the trusted fix and one unconfirmed relocation candidate.
export function advanceGps(previous,point,type='object',home=null){
 const state=structuredClone(previous||{});
 // Old states did not record whether a second fix corroborated their anchor.
 if(state.trusted&&state.provisional===undefined){
  state.provisional=true;state.pending=null;state.uncertain=true;
 }
 if(isMirrored(state.trusted,home)){
  // A confirmed home can identify a bad anchor saved by an older filter.
  state.trusted=null;state.pending=null;state.uncertain=true;
 }
 if(!validPoint(point)||!Number.isFinite(point.timestamp)||point.timestamp<=(state.seen??-Infinity))return {state,accepted:false};
 state.seen=point.timestamp;
 const anchor=state.trusted,speed=gpsSpeedLimit(type);
 const mirrored=isMirrored(point,anchor);
 // Many JT808 trackers report 100–140 m accuracy outdoors; only withhold clearly poor fixes.
 if(point.accuracy>150||isMirrored(point,home)||(!state.provisional&&mirrored)){
  // Only shout "uncertain" when we are actively discarding data while already having a fix.
  if(anchor)state.uncertain=true;
  state.pending=null;
  // Still learn a plausible battery even when the position is rejected.
  state.battery=smoothBattery(state.battery,point.battery,!!anchor);
  if(state.trusted)state.trusted=withBattery(state.trusted,state.battery);
  return {state,accepted:false};
 }
 if(!anchor){
  state.battery=smoothBattery(state.battery,point.battery,false);
  state.trusted=withBattery(point,state.battery);
  // First fix is provisional (needs corroboration) but not "uncertain" — that word is reserved
  // for cases where we are discarding newer data that disagrees with a trusted position.
  state.pending=null;state.provisional=true;state.uncertain=false;
  return {state,accepted:true};
 }
 const dt=(point.timestamp-anchor.timestamp)/1000,d=distance(anchor,point);
 // Even a cluster of fixes cannot confirm an implausible trip from the trusted fix.
 // Allow for travel with the tracker and ordinary GPS error.
 if(!state.provisional&&d>Math.max(1000,100*dt)){
  state.uncertain=true;state.pending=null;
  state.battery=smoothBattery(state.battery,point.battery,true);
  if(state.trusted)state.trusted=withBattery(state.trusted,state.battery);
  return {state,accepted:false};
 }
 // Sparse reports can make a large jump look plausible by speed alone.
 const maxUnconfirmedDistance=type==='cat'?95:Infinity;
 const suspicious=mirrored||d>Math.min(maxUnconfirmedDistance,Math.max(30,speed*Math.min(dt,30)));
 if(!suspicious){
  state.battery=smoothBattery(state.battery,point.battery,false);
  state.trusted=withBattery(point,state.battery);
  state.pending=null;state.provisional=false;state.uncertain=false;
  return {state,accepted:true};
 }
 const pending=state.pending,elapsed=pending?(point.timestamp-pending.timestamp)/1000:0;
 const confirmationWindow=type==='cat'?600:180;
 const confirmationRadius=Math.min(type==='cat'?75:Infinity,Math.max(35,speed*Math.min(Math.max(elapsed,0),10)));
 const consistent=pending&&distance(pending,point)<=confirmationRadius;
 if(consistent&&elapsed>=5&&elapsed<=confirmationWindow){
  const replaced=state.provisional?{timestamp:anchor.timestamp,confirmed:pending}:null;
  state.battery=smoothBattery(state.battery,point.battery,false);
  state.trusted=withBattery(point,state.battery);
  state.pending=null;state.provisional=false;state.uncertain=false;
  return {state,accepted:true,replaced};
 }
 // Do not let repeated copies of a fix, or a burst lasting <5 s, confirm it.
 if(!consistent||elapsed>confirmationWindow)state.pending=point;
 state.uncertain=true;
 state.battery=smoothBattery(state.battery,point.battery,true);
 if(state.trusted)state.trusted=withBattery(state.trusted,state.battery);
 return {state,accepted:false};
}
export function filterGps(points,type='object',initial={},home=null){
 let state=initial;const accepted=[];
 for(const p of [...points].filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp)){
  const result=advanceGps(state,p,type,home);state=result.state;
  if(result.replaced&&accepted[0]?.timestamp===result.replaced.timestamp){
   accepted[0]=result.replaced.confirmed;
  }
  if(result.accepted)accepted.push(p);
 }
 if(state.provisional&&state.pending&&accepted[0]?.timestamp===state.trusted?.timestamp)accepted.shift();
 return {state,points:accepted,rejected:points.filter(Boolean).length-accepted.length};
}
