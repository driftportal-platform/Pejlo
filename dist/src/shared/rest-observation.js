import {distance,validPoint} from './geo.js';
import {cleanAttachment} from './attachment.js';
import {animalType} from './activity.js';
import {gpsMovingPair} from './gps-motion.js';
import {reportStatus} from './report-status.js';

export const QUIET_DURATION=15*60000,QUIET_GAP=5*60000,QUIET_RADIUS=25;
const usable=p=>p&&p.valid===true&&validPoint(p)&&!(p.lat===0&&p.lon===0)&&!p.approximate&&Number.isFinite(p.speedKph)&&p.speedKph>=0&&
 (!Number.isFinite(p.accuracy)||p.accuracy<=25)&&(!Number.isFinite(p.satellites)||p.satellites>=4);
// Keep invalid/charging observations as barriers, rather than silently joining
// two quiet periods across a missing fix. Conflicting copies are barriers too.
export function restSamples(samples,now=Date.now()){
 const byTime=new Map();
 for(const p of samples||[]){
  if(!p||!Number.isFinite(p.timestamp)||p.timestamp>now)continue;
  const old=byTime.get(p.timestamp);
  if(old&&JSON.stringify(old)!==JSON.stringify(p))byTime.set(p.timestamp,{timestamp:p.timestamp,valid:false});
  else byTime.set(p.timestamp,p);
 }
 return [...byTime.values()].sort((a,b)=>a.timestamp-b.timestamp);
}
export function quietGps(samples,now=Date.now()){
 const intervals=[];let run=null,last=null;
 function finish(){if(run&&run.count>=4&&run.to-run.from>=QUIET_DURATION)intervals.push([run.from,run.to]);run=null;}
 for(const p of restSamples(samples,now)){
  if(!usable(p)||p.charging!==false||p.speedKph>1){finish();last=p;continue;}
  const bounds=run?{minLat:Math.min(run.minLat,p.lat),maxLat:Math.max(run.maxLat,p.lat),minLon:Math.min(run.minLon,p.lon),maxLon:Math.max(run.maxLon,p.lon)}:{minLat:p.lat,maxLat:p.lat,minLon:p.lon,maxLon:p.lon};
  if(!last||p.timestamp-last.timestamp>QUIET_GAP||p.breakBefore||distance({lat:bounds.minLat,lon:bounds.minLon},{lat:bounds.maxLat,lon:bounds.maxLon})>QUIET_RADIUS)finish();
  run=run?{...run,...bounds,to:p.timestamp,count:run.count+1}:{from:p.timestamp,to:p.timestamp,count:1,minLat:p.lat,maxLat:p.lat,minLon:p.lon,maxLon:p.lon};last=p;
 }
 finish();
 return intervals;
}
export function wornQuietIntervals(intervals,wear,until){
 const ordered=[...wear].sort((a,b)=>a.at-b.at),windows=[];let start=null;
 for(const e of ordered){if(e.at>until)break;if(e.worn&&start===null)start=e.at;else if(!e.worn&&start!==null){windows.push([start,e.at]);start=null;}}
 if(start!==null)windows.push([start,until]);
 return intervals.flatMap(([from,to])=>windows.map(([a,b])=>[Math.max(from,a),Math.min(to,b)]).filter(([a,b])=>b-a>=QUIET_DURATION));
}
export function petActivityStatus(data,profile,now=Date.now()){
 const unknown=detail=>({state:'unknown',label:'Aktivitet: ukendt',detail,since:null,until:null});
 if(data?.source!=='traccar'||!profile?.trackerId||data.device?.identifier!==profile.trackerId||!animalType(profile.type))return unknown('Vælg en tilknyttet dyreprofil for at se aktivitet.');
 if(data.device.status!=='online')return unknown('Afventer friske målinger fra en online tracker.');
 const attachment=cleanAttachment(profile.attachment,profile.trackerId,now);
 if(attachment?.state!=='worn')return unknown('Markér trackeren som påsat dyret under Indstillinger, og gem profilen.');
 const mode=reportStatus(data,now),chargeAt=data.telemetry?.receivedAt;
 if(mode.tone==='sleep'&&mode.sleepAt>=attachment.since&&data.telemetry?.charging===false&&Number.isFinite(chargeAt)&&chargeAt<=now&&now-chargeAt<=QUIET_DURATION)return {state:'rest',label:'Mulig hvile',detail:'Frisk dvalerapport fra en tracker markeret som påsat og uden opladning. Det er et estimat – ikke målt søvn.',since:mode.sleepAt,until:mode.sleepAt};
 if(data.gpsUncertain||data.gpsProvisional||data.positionLookupFailed||data.telemetry?.gpsClockAhead)return unknown('GPS-positionen er usikker eller har en tidsfejl. Aktivitet kan ikke vurderes endnu.');
 const samples=restSamples(data.restSamples,now).filter(p=>p.timestamp>=attachment.since),last=samples.at(-1),previous=samples.at(-2);
 if(!last||now-last.timestamp>QUIET_GAP)return unknown('Der mangler friske målinger. En heartbeat alene viser ikke hvile eller bevægelse.');
 if(last.charging===true)return unknown('Trackeren oplader. Det tæller ikke som dyrets hvile.');
 if(!usable(last)||last.charging!==false)return unknown('GPS eller opladningsstatus er utilstrækkelig til at vurdere aktivitet.');
 const quiet=quietGps(samples,now).at(-1);
 if(quiet&&quiet[1]===last.timestamp)return {state:'rest',label:'Mulig hvile',detail:'Mindst 15 minutters lav hastighed og positioner inden for 25 meter. Trackeren er markeret som påsat og oplader ikke. GPS-estimat – ikke målt søvn.',since:quiet[0],until:quiet[1]};
 if(gpsMovingPair(previous,last,profile.type,10))return {state:'moving',label:'I bevægelse',detail:'To friske GPS-målinger viser hastighed og en sammenhængende forskydning. Det er en GPS-vurdering.',since:previous.timestamp,until:last.timestamp};
 return unknown('Afventer mindst 15 minutters sammenhængende ro eller tydelig bevægelse.');
}
