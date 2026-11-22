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
 const c=cleanWifiConfig(config),t=data?.telemetry;
 const at=t?.wifiMeasuredAt;
 const all=cleanAccessPoints(t?.wifiAccessPoints),points=all.filter(p=>c.macs.includes(p.mac));
 const fresh=Number.isFinite(at)&&at<=now+10000&&now-at<=WIFI_MAX_AGE&&data?.device?.status==='online';
 return {config:c,at,all,points,fresh};
}
export function homeWifiStatus(data,config,now=Date.now()){
 const o=wifiObservation(data,config,now),base={...o,label:'Usikkert',kind:'unknown'};
 if(!o.config.macs.length)return {...base,note:'Tilføj hjemmets Wi-Fi-adresser under Indstillinger.'};
 if(!o.fresh)return {...base,note:'Afventer en frisk Wi-Fi-måling fra en online tracker.'};
 if(!o.points.length)return {...base,note:'Hjemmets Wi-Fi er ikke registreret i denne måling. Det beviser ikke, at trackeren er udenfor.'};
 const inside=o.config.samples.filter(s=>s.label==='inside'),outside=o.config.samples.filter(s=>s.label==='outside');
 if(inside.length<3||outside.length<3)return {...base,note:'Hjemmets Wi-Fi registreret. Gem mindst tre målinger inde og tre ude for at lære signalmønstret.'};
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
