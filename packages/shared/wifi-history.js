import {cleanAccessPoints} from './home-wifi.js';
export function rememberWifi(previous,telemetry,now=Date.now()){
 const clean=v=>{const points=cleanAccessPoints(v?.points),at=v?.at;return points.length&&Number.isFinite(at)&&at>0&&at<=now+10000?{points,at}:null;};
 const old=clean(previous),next=clean({points:telemetry?.wifiAccessPoints,at:telemetry?.wifiMeasuredAt});
 return next&&(!old||next.at>old.at)?next:old;
}
export function wifiDisplay(status,last){
 const points=cleanAccessPoints(last?.points).filter(p=>status.config.macs.includes(p.mac));
 if(status.points.length)return {...status,historical:!status.fresh};
 if(points.length&&Number.isFinite(last?.at)&&last.at>0&&last.at<=Date.now()+10000)return {...status,points,at:last.at,fresh:false,historical:true};
 return {...status,historical:false};
}
export function wifiCardText(status,ageText){
 if(!status.config.macs.length)return {value:'Opsæt hjemmets Wi-Fi',note:'Brug Hurtig Wi-Fi-opsætning under Indstillinger → Profil'};
 const strongest=status.points[0],saved=status.config.macs.length+(status.config.macs.length===1?' punkt gemt':' punkter gemt');
 if(strongest)return {value:(status.historical?'Sidst målt: ':'')+strongest.rssi+' dBm',note:status.points.length+' af '+status.config.macs.length+' punkter'+(status.fresh?' · vejledende signalstyrke':' · målt '+ageText(status.at)+' · afventer ny scanning')};
 if(status.fresh&&status.all.length)return {value:'Hjemmets punkter ikke set',note:saved+' · ikke med i den seneste scanning; placering er usikker'};
 return {value:'Afventer Wi-Fi-scanning',note:saved+' · GPS- og mobilkontakt kan være friske imens'};
}
