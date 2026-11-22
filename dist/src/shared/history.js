import {distance} from './geo.js';
export const danishDate=(now=Date.now())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
function midnight(date){
 const target=Date.parse(date+'T00:00:00Z');let utc=target;
 for(let i=0;i<3;i++){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);utc+=target-represented;
 }
 return utc;
}
export function historyRange(start,end=start,now=Date.now()){
 if(!validDate(start)||!validDate(end)||start>end||end>danishDate(now))throw Error('Vælg gyldige datoer frem til i dag.');
 const next=new Date(Date.parse(end)+86400000).toISOString().slice(0,10),from=midnight(start),to=Math.min(midnight(next),now);
 if(to-from>31*86400000+3600000)throw Error('Vælg højst 31 dage ad gangen.');
 return {from,to};
}
export function routeAnalysis(points){
 const segments=[],gaps=[],accepted=[];let segment=[],meters=0,rejected=0;
 for(const p of points){
  if(!Number.isFinite(p?.lat)||!Number.isFinite(p?.lon)||!Number.isFinite(p?.timestamp))continue;
  const last=accepted.at(-1);
  if(last){
   const dt=(p.timestamp-last.timestamp)/1000,d=distance(last,p);
   if(dt<=0){rejected++;continue;}
   // A broad ceiling fits pets, bicycles and cars. It is not a measured trip distance.
   if(dt<=600&&d/dt>70){rejected++;continue;}
   if(dt>600){if(segment.length)segments.push(segment);gaps.push({from:last.timestamp,to:p.timestamp});segment=[];}
   else if(d>=5)meters+=d;
  }
  segment.push(p);accepted.push(p);
 }
 if(segment.length)segments.push(segment);
 return {segments,gaps,points:accepted,meters,rejected};
}
