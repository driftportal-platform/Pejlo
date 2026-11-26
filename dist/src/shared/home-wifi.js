// Wi-Fi fingerprints are a local guide, never a calibrated probability or proof of being indoors.
export const WIFI_MAX_AGE=120000;
export function normalizeMac(value){
 if(typeof value!== 'string')return null;
 const mac=value.trim().toUpperCase().replaceAll('-',':');
 return /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)&&mac!=='00:00:00:00:00:00'&&mac!=='FF:FF:FF:FF:FF:FF'&&!(parseInt(mac.slice(0,2),16)&1)?mac:null;
}
export function cleanAccessPoints(raw){
 if(!Array.isArray(raw))return [];
 const found=new Map();
 for(const v of raw.slice(0,64)){
  const mac=normalizeMac(v?.macAddress??v?.mac),rssi=v?.signalStrength??v?.rssi;
  if(mac&&Number.isInteger(rssi)&&rssi>=-100&&rssi<=-1)found.set(mac,{mac,rssi:Math.max(rssi,found.get(mac)?.rssi??-100)});
 }
 return [...found.values()].sort((a,b)=>b.rssi-a.rssi).slice(0,16);
}
export function cleanWifiConfig(raw){
 const macs=[...new Set((Array.isArray(raw?.macs)?raw.macs:[]).map(normalizeMac).filter(Boolean))].slice(0,16);
 const samples=(Array.isArray(raw?.samples)?raw.samples:[]).flatMap(s=>{
  const points=cleanAccessPoints(s?.points).filter(p=>macs.includes(p.mac));
  return ['inside','outside'].includes(s?.label)&&Number.isFinite(s?.at)&&s.at>0&&points.length?[{label:s.label,at:s.at,points}]:[];
 }).filter((s,i,a)=>a.findIndex(x=>x.at===s.at)===i).slice(-40);
 return {macs,samples};
}
export function wifiObservation(data,config,now=Date.now()){
 const observations=wifiObservations(data,config,now);
 if(observations.length)return observations.at(-1);
 const c=cleanWifiConfig(config),t=data?.telemetry;
 return {config:c,at:t?.wifiMeasuredAt,all:[],points:[],fresh:false};
}
// Keep measurement times: subsequent GPS packets and repeated polls are not scans.
export function wifiObservations(data,config,now=Date.now()){
 const c=cleanWifiConfig(config),t=data?.telemetry;
 const scans=[...(Array.isArray(t?.wifiScans)?t.wifiScans.slice(-64):[]),t?.lastWifi,{at:t?.wifiMeasuredAt,points:t?.wifiAccessPoints}],found=new Map();
 for(const scan of scans){
  const at=scan?.at,all=cleanAccessPoints(scan?.points);
  if(!all.length||!Number.isFinite(at)||at<=0||at>now+10000)continue;
  found.set(at,{config:c,at,all,points:all.filter(p=>c.macs.includes(p.mac)),fresh:now-at<=WIFI_MAX_AGE&&data?.device?.status==='online'});
 }
 return [...found.values()].sort((a,b)=>a.at-b.at).slice(-64);
}
export function homeWifiStatus(data,config,now=Date.now()){
 const o=wifiObservation(data,config,now),base={...o,label:'Usikkert',kind:'unknown'};
 if(!o.config.macs.length)return {...base,note:'Brug Hurtig Wi-Fi-opsætning under Indstillinger → Profil.'};
 if(!o.fresh)return {...base,note:'Afventer en frisk Wi-Fi-måling fra en online tracker.'};
 if(!o.points.length)return {...base,note:'Hjemmets Wi-Fi er ikke registreret i denne måling. Det beviser ikke, at trackeren er udenfor.'};
 const inside=o.config.samples.filter(s=>s.label==='inside'),outside=o.config.samples.filter(s=>s.label==='outside');
 if(inside.length<3||outside.length<3)return {...base,note:'Hjemmets Wi-Fi registreret. Hurtig Wi-Fi-opsætning samler og gemmer tre målinger inde og tre ude for dig.'};
 // Require comparable fingerprints: missing access points must not imply being outside.
 const score=s=>{
  const shared=o.points.flatMap(p=>{const q=s.points.find(q=>q.mac===p.mac);return q?[Math.abs(p.rssi-q.rssi)]:[];});
  return shared.length===o.points.length?shared.reduce((a,b)=>a+b,0)/shared.length:Infinity;
 };
 const a=Math.min(...inside.map(score)),b=Math.min(...outside.map(score));
 if(!Number.isFinite(a)||!Number.isFinite(b)||Math.min(a,b)>8||Math.abs(a-b)<8)return {...base,note:'Wi-Fi-signalet kan ikke tydeligt skelne inde fra ude her.'};
 const isInside=a<b;
 return {...base,kind:isInside?'inside':'outside',label:isInside?'Sandsynligvis indenfor':'Sandsynligvis udenfor',note:'Wi-Fi-mønstret ligner dine '+(isInside?'indendørs':'udendørs')+' målinger. Vejledende vurdering; vinduer, vægge og placering påvirker signalet.'};
}
export function addWifiSample(config,data,label,now=Date.now()){
 if(!['inside','outside'].includes(label))throw Error('Vælg inde eller ude.');
 const o=wifiObservation(data,config,now);
 if(!o.fresh||!o.points.length)throw Error('Afvent en frisk måling af hjemmets Wi-Fi fra en online tracker.');
 if(o.config.samples.some(s=>Math.abs(s.at-o.at)<20000))throw Error('Vent på en ny Wi-Fi-måling, mindst 20 sekunder efter den senest gemte.');
 return cleanWifiConfig({...o.config,samples:[...o.config.samples,{label,at:o.at,points:o.points}]});
}

