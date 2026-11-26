import {distance,validPoint} from './geo.js';
import {gpsSpeedLimit,gpsMovingPair} from './gps-motion.js';
export {gpsSpeedLimit} from './gps-motion.js';
function isMirrored(point,reference){
 return validPoint(point)&&validPoint(reference)&&
  distance(reference,{lat:-point.lat,lon:-point.lon})<=25000&&distance(reference,point)>1000000;
}
// State contains only the trusted fix and one unconfirmed relocation candidate.
export function advanceGps(previous,point,type='object',home=null){
 const state=structuredClone(previous||{});
 if(state.trusted?.lat===0&&state.trusted?.lon===0){state.trusted=null;state.pending=null;state.seen=null;state.uncertain=true;}
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
 if(point.accuracy>100||isMirrored(point,home)||(!state.provisional&&mirrored)){
  state.uncertain=true;state.pending=null;return {state,accepted:false};
 }
 if(!anchor){state.trusted=point;state.pending=null;state.provisional=true;state.uncertain=true;return {state,accepted:true};}
 const dt=(point.timestamp-anchor.timestamp)/1000,d=distance(anchor,point);
 // Even a cluster of fixes cannot confirm an implausible trip from the trusted fix.
 // Allow for travel with the tracker and ordinary GPS error.
 if(!state.provisional&&d>Math.max(1000,100*dt)){
  state.uncertain=true;state.pending=null;return {state,accepted:false};
 }
 // Two high-quality fixes with travel supported by the reported speed do not
 // require the animal to stop in a 75 m cluster before the marker can move.
 if(!mirrored&&gpsMovingPair(anchor,point,type,10,false)){
  state.trusted=point;state.pending=null;state.provisional=false;state.uncertain=false;
  return {state,accepted:true};
 }
 // Sparse reports can make a large jump look plausible by speed alone.
 const maxUnconfirmedDistance=type==='cat'?95:Infinity;
 const suspicious=mirrored||d>Math.min(maxUnconfirmedDistance,Math.max(30,speed*Math.min(dt,30)));
 if(!suspicious){state.trusted=point;state.pending=null;state.provisional=false;state.uncertain=false;return {state,accepted:true};}
 const pending=state.pending,elapsed=pending?(point.timestamp-pending.timestamp)/1000:0;
 const moving=pending&&gpsMovingPair(pending,point,type,10);
 // Recover a previously held marker too, including anchors saved before speed
 // and satellite metadata were retained. Reject an out-and-back jump here.
 if(!mirrored&&moving&&d>=distance(anchor,pending)-15&&distance(anchor,pending)+moving.meters<=d*1.8){
  const replaced=state.provisional?{timestamp:anchor.timestamp,confirmed:pending}:null;
  state.trusted=point;state.pending=null;state.provisional=false;state.uncertain=false;
  return {state,accepted:true,replaced};
 }
 const confirmationWindow=type==='cat'?600:180;
 const confirmationRadius=Math.min(type==='cat'?75:Infinity,Math.max(35,speed*Math.min(Math.max(elapsed,0),10)));
 const consistent=pending&&distance(pending,point)<=confirmationRadius;
 if(consistent&&elapsed>=5&&elapsed<=confirmationWindow){
  const replaced=state.provisional?{timestamp:anchor.timestamp,confirmed:pending}:null;
  state.trusted=point;state.pending=null;state.provisional=false;state.uncertain=false;
  return {state,accepted:true,replaced};
 }
 // Do not let repeated copies of a fix, or a burst lasting <5 s, confirm it.
 if(!consistent||elapsed>confirmationWindow)state.pending=point;
 state.uncertain=true;return {state,accepted:false};
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

