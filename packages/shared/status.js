import {validPoint,distance,bearing,directionName} from './geo.js';
import {fenceDistance} from './fence.js';
export function homeStatus(profile,position,now=Date.now()){
 if(!profile?.homeConfirmed)return 'Intet hjemmeområde valgt';
 if(!position||!Number.isFinite(position.timestamp))return 'Afventer gyldig GPS-position';
 const inside=fenceDistance(profile.home,position)<=0,old=now-position.timestamp>300000;
 return old?(inside?'Sidst set hjemme':'Sidst set uden for hjemmeområdet'):(inside?'Senest registreret i hjemmeområdet':'Senest registreret uden for hjemmeområdet');
}
export function recentMovement(route,position,now=Date.now()){
 if(!position||!Number.isFinite(position.timestamp)||position.timestamp>now+60000||now-position.timestamp>300000||!Array.isArray(route))return null;
 const points=route.filter(p=>p.timestamp<=position.timestamp&&p.timestamp>=position.timestamp-180000).slice(-6);
 if(points.some(p=>!validPoint(p)||!Number.isFinite(p.timestamp))||points.length<3||points.at(-1).timestamp!==position.timestamp)return null;
 let length=0;
 for(let i=1;i<points.length;i++){const dt=(points[i].timestamp-points[i-1].timestamp)/1000,meters=distance(points[i-1],points[i]);if(dt<=0||dt>120||meters/dt>70)return null;length+=meters;}
 const start=points[0],end=points.at(-1),meters=distance(start,end),uncertainty=Math.max(...points.map(p=>p.accuracy||0));
 if(meters<Math.max(20,uncertainty*2)||!length||meters/length<.75)return null;
 const degrees=bearing(start,end);return {degrees,direction:directionName(degrees),meters,from:start.timestamp,to:end.timestamp};
}
export function ageText(stamp,now=Date.now()){
 if(!Number.isFinite(stamp))return 'Ikke oplyst';const seconds=Math.max(0,Math.floor((now-stamp)/1000));return seconds<60?seconds+' sek. siden':seconds<3600?Math.floor(seconds/60)+' min. siden':seconds<86400?Math.floor(seconds/3600)+' timer siden':Math.floor(seconds/86400)+' dage siden';
}
/**
 * Stable connection view for JT808 trackers that briefly flap offline in Traccar.
 * Prefer lastContact over the raw online/offline flag when the contact is recent.
 *
 * Returns {state, label, detail}
 *  state: 'online' | 'recent' | 'offline' | 'unknown'
 */
export function connectionStatus(device,now=Date.now()){
 const raw=device?.status;
 const contact=Number.isFinite(device?.lastContact)?device.lastContact:null;
 const age=contact!=null?Math.max(0,now-contact):null;
 // Traccar often marks a device offline within a minute of a missed heartbeat.
 // Treat a recent contact as still connected so the UI does not flicker.
 if(age!=null&&age<=5*60*1000){
  return {state:'online',label:'Online',detail:age<60*1000?'Aktiv nu':'Senest set '+ageText(contact,now)};
 }
 if(age!=null&&age<=30*60*1000){
  return {state:'recent',label:'Senest set '+ageText(contact,now),detail:'Ingen frisk kontakt · seneste position kan stadig vises'};
 }
 if(raw==='online'&&age==null){
  return {state:'online',label:'Online',detail:'Aktiv nu'};
 }
 if(raw==='offline'||(age!=null&&age>30*60*1000)){
  return {state:'offline',label:'Offline',detail:contact!=null?'Senest set '+ageText(contact,now):'Ingen kontakt registreret'};
 }
 return {state:'unknown',label:'Ukendt',detail:contact!=null?'Senest set '+ageText(contact,now):'Ingen kontaktoplysning'};
}
