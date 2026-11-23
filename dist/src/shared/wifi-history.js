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
