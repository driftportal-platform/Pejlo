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
