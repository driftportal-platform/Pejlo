import {types} from './profiles.js';
import {distance,validPoint} from './geo.js';
import {danishDate,historyRange} from './history.js';
import {gpsSpeedLimit} from './gps-filter.js';

export const animalType=type=>Object.hasOwn(types,type)&&types[type].category==='dyr';
export function activityDates(from,to,now=Date.now()){
 historyRange(from,to,now);
 const days=[];for(let at=Date.parse(from);at<=Date.parse(to);at+=86400000)days.push(new Date(at).toISOString().slice(0,10));
 return days;
}
export function activityNumber(value,max,label){
 if(value===null)return null;
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw Error(label+' skal være et tal mellem 0 og '+max+'.');
 return Math.round(value*100)/100;
}
export function activityAdvice(type){
 const advice={
  cat:{text:'Tilbyd korte lege med pauser flere gange om dagen. Der findes ikke ét motionsmål, der passer til alle katte. Brug kilometer som overblik over kattens egne vaner, og tilpas aktivitet til alder, helbred og lyst.',label:'PDSA: motion til katte',url:'https://www.pdsa.org.uk/get-involved/our-campaigns/weigh-up/your-cat/your-cats-body-shape/how-to-exercise-your-cat'},
  dog:{text:'Giv daglig bevægelse og mental aktivering. Behovet afhænger af race, alder, helbred og form; et kilometermål alene beskriver ikke hele behovet. Tilpas målet til hunden, og få dyrlægens hjælp ved sygdom eller tvivl.',label:'PDSA: motion til hunde',url:'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/puppies-dogs/how-much-exercise-does-your-dog-need'},
  horse:{text:'Foldtid, mulighed for bevægelse og social kontakt er vigtige. Tilpas træning og kilometermål til hestens helbred, form og brug. Kilometer alene er ikke et mål for trivsel.',label:'British Horse Society: hestens omgivelser',url:'https://www.bhs.org.uk/horse-care-and-welfare/ownership-loaning/where-to-keep-your-horse/'}
 };
 return advice[type]||{text:'Andet dyr dækker mange arter med forskellige behov. Vælg et individuelt mål ud fra arten, alder og helbred sammen med en dyrlæge. Appen foreslår derfor ikke et bestemt antal kilometer.',label:null,url:null};
}
// This describes observed GPS coverage, not measured sleep or a complete day's activity.
export function activityGps(route,type,now=Date.now()){
 const days=new Map();let previous=null,rejected=0;
 const points=(Array.isArray(route)?route:[]).filter(p=>validPoint(p)&&p.valid!==false&&!p.approximate&&!(p.lat===0&&p.lon===0)&&Number.isFinite(p.timestamp)&&p.timestamp<=now).sort((a,b)=>a.timestamp-b.timestamp);
 for(const p of points){
  const day=danishDate(p.timestamp);let row=days.get(day);if(!row){row={day,meters:0,observedMinutes:0,quietMinutes:0,points:0};days.set(day,row);}
  if(previous?.timestamp===p.timestamp)continue;
  row.points++;
  if(previous&&danishDate(previous.timestamp)===day){
   const dt=(p.timestamp-previous.timestamp)/1000,d=distance(previous,p);
   if(dt>0&&dt<=300&&d/dt<=gpsSpeedLimit(type)){
    row.observedMinutes+=dt/60;
    if(d<10)row.quietMinutes+=dt/60;else row.meters+=d;
   }else rejected++;
  }
  previous=p;
 }
 return {days:[...days.values()].map(d=>({...d,km:d.observedMinutes>0?d.meters/1000:null})),rejected};
}
export function mergeActivity(days,entries,gps=[]){
 const manual=new Map(entries.map(e=>[e.day,e])),scans=new Map(gps.map(e=>[e.day,e]));
 return days.map(day=>{const e=manual.get(day),g=scans.get(day),manualKm=e?.km??null,gpsKm=g?.km??null;return {day,manualKm,gpsKm,km:manualKm??gpsKm,source:manualKm!==null?'manual':gpsKm!==null?'gps':'unknown',restHours:e?.rest_hours??null,quietMinutes:g?.observedMinutes>0?g.quietMinutes:null,coverageMinutes:g?.observedMinutes??null,note:e?.note||'',revision:e?.revision??0,goalKm:e?.goal_km??null};});
}
export function activityCsv(rows){
 const cell=value=>{let s=value==null?'':typeof value==='number'?String(Math.round(value*100)/100).replace('.',','):String(value);if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const values=[['Dato','Manuelt km','GPS km anslaaet','Valgt km','Distancekilde','Observeret hvile timer','Ro ved GPS-sted minutter','GPS-daekning minutter','Maal ved foerste registrering km','Note'],...rows.map(r=>[r.day,r.manualKm,r.gpsKm,r.km,r.source,r.restHours,r.quietMinutes,r.coverageMinutes,r.goalKm,r.note])];
 return '\ufeff'+values.map(row=>row.map(cell).join(';')).join('\r\n');
}
