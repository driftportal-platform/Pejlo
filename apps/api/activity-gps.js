import {chargingHistory} from '../../packages/shared/charging-history.js';
import {ensureActivityGps} from './activity-store.js';
import {activityAccess} from './activity-access.js';
import {activityDates,activityGps} from '../../packages/shared/activity.js';
import {historyRange,danishDate} from '../../packages/shared/history.js';
import {filterGps} from '../../packages/shared/gps-filter.js';
import {gpsPoint} from './gps.js';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
// Completed days are reused for a day, then refreshed to include late uploads.
// Today is short lived. Context includes the server, species, home and algorithm.
export async function activityGpsAPI({db,uid,query,device,traccar,source,now=Date.now()}){
 const {owner,scope,profile}=await activityAccess(db,uid,query);
 if(!query.identifier||!profile)fail(400,'Vælg en tilknyttet dyreprofil.');
 const dates=activityDates(query.from,query.to,now),today=danishDate(now),home=profile.homeConfirmed?profile.home:null;
 const context=JSON.stringify([3,source,query.identifier,device.id,profile.type,home]);
 await ensureActivityGps(db);
 const records=await db.prepare('SELECT day,context,summary,checked_at FROM pejlo_activity_gps WHERE owner_uid=? AND scope=? AND day>=? AND day<=?').bind(owner,scope,query.from,query.to).all();
 const cache=new Map(records.results.map(r=>[r.day,r])),days=[],missing=[];
 for(const day of dates){
  const r=cache.get(day),ttl=day===today?120000:86400000,summary=r?JSON.parse(r.summary):null;
  if(r&&r.context===context&&r.checked_at<=now&&now-r.checked_at<ttl&&(day===today||summary.closed))days.push({...summary,cached:true});else missing.push(day);
 }
 // Fetch adjacent missing days together; this keeps at most two normal route
 // requests for a warm range and never sends raw historical routes to the app.
 const groups=[];for(const day of missing){const last=groups.at(-1);if(last&&Date.parse(day)-Date.parse(last.at(-1))===86400000)last.push(day);else groups.push([day]);}
 for(const group of groups){
  const range=historyRange(group[0],group.at(-1),now);
  const raw=await traccar('/api/reports/route?'+new URLSearchParams({deviceId:String(device.id),from:new Date(range.from).toISOString(),to:new Date(range.to).toISOString()}));
  if(!Array.isArray(raw))fail(502,'GPS-historikken kunne ikke hentes. Prøv igen.');
  const points=raw.filter(p=>p.deviceId===device.id).map(gpsPoint).filter(p=>p&&p.timestamp>=range.from&&p.timestamp<range.to);
  const truncated=raw.length>=10000;
  for(const day of group){
   const filtered=filterGps(points.filter(p=>danishDate(p.timestamp)===day),profile.type,{},home);
   const reports=raw.filter(p=>p.deviceId===device.id&&p.attributes?.charge===true).map(p=>({timestamp:Date.parse(p.fixTime),charging:true})).filter(p=>Number.isFinite(p.timestamp)&&p.timestamp>=range.from&&p.timestamp<range.to&&danishDate(p.timestamp)===day);
   const charging=chargingHistory(filtered.points,profile.type,reports),analysis=activityGps(charging.points,profile.type,now);
   const d=analysis.days[0]||{day,km:null,meters:0,observedMinutes:0,quietMinutes:0,points:0};
   const summary={...d,chargingExcluded:charging.excluded,truncated,closed:day<today};days.push({...summary,cached:false});
   // A capped report may omit complete days; do not cache it as a reliable result.
   if(!truncated)await db.prepare('INSERT INTO pejlo_activity_gps(owner_uid,scope,day,context,summary,checked_at) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_uid,scope,day) DO UPDATE SET context=excluded.context,summary=excluded.summary,checked_at=excluded.checked_at WHERE excluded.checked_at>=checked_at').bind(owner,scope,day,context,JSON.stringify(summary),now).run();
  }
 }
 days.sort((a,b)=>a.day.localeCompare(b.day));
 return {days,from:query.from,to:query.to,historyAvailable:true,historyTruncated:days.some(d=>d.truncated),points:days.reduce((sum,d)=>sum+d.points,0),cachedDays:days.filter(d=>d.cached).length,chargingExcluded:days.reduce((sum,d)=>sum+(d.chargingExcluded||0),0),checkedAt:now};
}
