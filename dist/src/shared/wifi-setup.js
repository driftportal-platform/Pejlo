import {cleanWifiConfig,normalizeMac,wifiObservation,wifiObservations,homeWifiStatus} from './home-wifi.js';

export function wifiSetupReadout(data,config,now=Date.now()){
 const o=wifiObservation(data,config,now),p=(o.config.macs.length?o.points:o.all)[0];
 const average=label=>{const rows=o.config.samples.filter(s=>s.label===label);return rows.length?Math.round(rows.reduce((n,s)=>n+Math.max(...s.points.map(p=>p.rssi)),0)/rows.length):null;};
 const inside=average('inside'),outside=average('outside');
 return {at:Number.isFinite(o.at)?o.at:null,fresh:o.fresh,rssi:p?.rssi??null,seen:o.all.length,matched:o.points.length,configured:o.config.macs.length,
  strength:!o.fresh||!p?'unknown':p.rssi>=-60?'strong':p.rssi>=-75?'medium':'weak',inside,outside,difference:inside===null||outside===null?null:Math.abs(inside-outside)};
}

export function wifiSetupQuality(config){
 const c=cleanWifiConfig(config),counts={inside:0,outside:0};
 for(const s of c.samples){
  const status=homeWifiStatus({device:{status:'online'},telemetry:{wifiMeasuredAt:s.at,wifiAccessPoints:s.points}},c,s.at);
  if(status.kind===s.label)counts[s.label]++;
 }
 return counts.inside>=2&&counts.outside>=2?'distinct':'uncertain';
}

// Labels come from the user's explicit indoor/outdoor step, never from GPS or RSSI.
export function createWifiSetup(config,now=Date.now(),resumeOutside=false){
 const initial=cleanWifiConfig(config);
 let macs=[...initial.macs],confirmed=macs.length>0,phase='inside',startedAt=now,lastAt=0;
 let inside=[],outside=[];
 if(resumeOutside){
  inside=initial.samples.filter(s=>s.label==='inside').slice(-3);
  if(!confirmed||inside.length<3)throw Error('Saml først tre målinger inde.');
  phase='outside';
 }
 const copy=value=>structuredClone(value);
 return {
  snapshot:()=>copy({phase,macs,confirmed,inside,outside,startedAt}),
  observe(data,at=Date.now()){
   if(!['inside','outside'].includes(phase))return false;
   let changed=false;
   for(const o of wifiObservations(data,{macs},at)){
   if(!['inside','outside'].includes(phase))break;
   const points=confirmed?o.points:o.all;
   if(!o.fresh||!points.length||o.at<startedAt||o.at<=lastAt||lastAt&&o.at-lastAt<20000)continue;
   changed=true;
   lastAt=o.at;
   const samples=phase==='inside'?inside:outside;
   samples.push({label:phase,at:o.at,points:copy(points)});
   if(samples.length===3)phase=phase==='inside'?(confirmed?'inside-ready':'choose'):'done';
   }
   return changed;
  },
  candidates(){
   const found=new Map();
   for(const sample of inside)for(const p of sample.points){
    const row=found.get(p.mac)||{mac:p.mac,total:0,seen:0};
    row.total+=p.rssi;row.seen++;found.set(p.mac,row);
   }
   return [...found.values()].map(p=>({mac:p.mac,rssi:Math.round(p.total/p.seen),seen:p.seen,recommended:p.seen===3&&p.total/p.seen>=-75})).sort((a,b)=>Number(b.recommended)-Number(a.recommended)||b.rssi-a.rssi).slice(0,16);
  },
  choose(values){
   if(phase!=='choose')throw Error('Afvent de første målinger inde.');
   const selected=[...new Set(values.map(normalizeMac))],available=new Set(inside.flatMap(s=>s.points.map(p=>p.mac)));
   if(!selected.length||selected.length>16||selected.some(mac=>!mac||!available.has(mac)))throw Error('Vælg mindst ét registreret punkt fra dit hjem, højst 16.');
   macs=selected;confirmed=true;
   inside=inside.map(s=>({...s,points:s.points.filter(p=>macs.includes(p.mac))})).filter(s=>s.points.length);
   phase=inside.length===3?'inside-ready':'inside';
  },
  startOutside(at=Date.now()){
   if(phase!=='inside-ready')throw Error('Afvent tre målinger inde og gemning.');
   phase='outside';startedAt=at;
  },
  configuration(){
   if(!confirmed||!['inside-ready','done'].includes(phase))throw Error('Afvent tre forskellige målinger.');
   return cleanWifiConfig({macs,samples:[...inside,...outside]});
  }
 };
}
