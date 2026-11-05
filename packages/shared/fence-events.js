import {validPoint} from './geo.js';
import {fenceDistance} from './fence.js';
export function advanceFence(home,raw,state,now=Date.now()){
 const time=Date.parse(raw?.fixTime);
 if(raw?.valid!==true||!validPoint({lat:raw.latitude,lon:raw.longitude})||!Number.isFinite(time)||time>now+60000||now-time>300000||time<=(state.last||0))return {state};
 const margin=fenceDistance(home,{lat:raw.latitude,lon:raw.longitude});
 if(typeof state.outside!=='boolean')return {state:{outside:margin>0,last:time,pending:0}};
 const buffer=home.buffer??5;
 const crossed=state.outside?margin< -buffer:margin>buffer;
 const pending=crossed?(state.pending||0)+1:0;
 return pending>=2?{state:{outside:!state.outside,last:time,pending:0},transition:state.outside?'enter':'exit'}:{state:{...state,last:time,pending}};
}
