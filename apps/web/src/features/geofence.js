import {fenceDistance} from '../shared/fence.js';
// Session-local transitions use two different GPS fixes and a 15 m boundary buffer.
// Never infer an exit from an old fix, demo data, or a failed request.
export function createGeofenceMonitor(){
 const states=new Map();
 return {clear(){states.clear();}, evaluate(profile,data,{now=Date.now(),unavailable=false}={}){
  if(!profile?.geofenceEnabled)return {text:'Hjemmeområde er slået fra',kind:'off'};
  if(!profile.homeConfirmed)return {text:'Vælg og gem hjemmeområdet først',kind:'unknown'};
  const p=data?.position;
  if(!profile.trackerId||data?.source!=='traccar')return {text:'Tilknyt en tracker for at overvåge området',kind:'unknown'};
  if(unavailable||!p||!Number.isFinite(p.timestamp)||p.timestamp>now+60000||now-p.timestamp>300000)return {text:'Afventer en frisk position · området kan ikke vurderes',kind:'unknown'};
  const key=JSON.stringify([profile.id,profile.trackerId,profile.home]);
  let state=states.get(key);const meters=fenceDistance(profile.home,p),radius=0;
  if(!state){state={outside:meters>radius,last:p.timestamp,pending:0};states.set(key,state);}
  let transition=null;
  if(p.timestamp>state.last){
   const crossed=state.outside?meters<radius-15:meters>radius+15;
   state.pending=crossed?state.pending+1:0;state.last=p.timestamp;
   if(state.pending>=2){state.outside=!state.outside;state.pending=0;transition=state.outside?'exit':'enter';}
  }
  return {kind:state.outside?'outside':'inside',text:state.pending?'Kontrollerer passage af områdets grænse…':state.outside?'Uden for hjemmeområdet':'Inden for hjemmeområdet',transition};
 }};
}
