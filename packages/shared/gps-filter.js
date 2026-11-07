import {distance,validPoint} from './geo.js';
export const gpsSpeedLimit=type=>({cat:12,dog:15,horse:25,animal:15,bicycle:20,car:70,object:20}[type]??20);
// State contains only the trusted fix and one unconfirmed relocation candidate.
export function advanceGps(previous,point,type='object'){
 const state=structuredClone(previous||{});
 if(!validPoint(point)||!Number.isFinite(point.timestamp)||point.timestamp<=(state.seen??-Infinity))return {state,accepted:false};
 state.seen=point.timestamp;
 if(point.accuracy>100){state.uncertain=true;state.pending=null;return {state,accepted:false};}
 const anchor=state.trusted,speed=gpsSpeedLimit(type);
 if(!anchor){state.trusted=point;state.pending=null;state.uncertain=false;return {state,accepted:true};}
 const dt=(point.timestamp-anchor.timestamp)/1000,d=distance(anchor,point);
 const suspicious=d>Math.max(30,speed*Math.min(dt,30));
 if(!suspicious){state.trusted=point;state.pending=null;state.uncertain=false;return {state,accepted:true};}
 const pending=state.pending,elapsed=pending?(point.timestamp-pending.timestamp)/1000:0;
 if(pending&&elapsed>=5&&elapsed<=180&&distance(pending,point)<=Math.max(35,speed*Math.min(elapsed,10))){
  state.trusted=point;state.pending=null;state.uncertain=false;return {state,accepted:true};
 }
 // Do not let repeated copies of a fix, or a burst lasting <5 s, confirm it.
 if(!pending||elapsed>180||distance(pending,point)>Math.max(35,speed*Math.min(Math.max(elapsed,0),10)))state.pending=point;
 state.uncertain=true;return {state,accepted:false};
}
export function filterGps(points,type='object',initial={}){
 let state=initial;const accepted=[];
 for(const p of [...points].filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp)){
  const result=advanceGps(state,p,type);state=result.state;if(result.accepted)accepted.push(p);
 }
 return {state,points:accepted,rejected:points.filter(Boolean).length-accepted.length};
}
