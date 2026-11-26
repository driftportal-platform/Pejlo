import {distance,validPoint} from './geo.js';
export const gpsSpeedLimit=type=>({cat:12,dog:15,horse:25,animal:15,bicycle:20,car:70,object:20}[type]??20);
// Position display can start from a stationary fix; activity/rest interruption
// additionally require reported speed at both ends of the measured movement.
export function gpsMovingPair(a,b,type,minimum=10,bothMoving=true){
 const limit=gpsSpeedLimit(type);
 const good=p=>p?.valid===true&&validPoint(p)&&!(p.lat===0&&p.lon===0)&&!p.approximate&&p.charging===false&&Number.isInteger(p.satellites)&&p.satellites>=6&&Number.isFinite(p.speedKph)&&p.speedKph>=0&&p.speedKph/3.6<=limit&&(!Number.isFinite(p.accuracy)||p.accuracy<=25);
 if(!good(a)||!good(b)||!Number.isFinite(a.timestamp)||!Number.isFinite(b.timestamp)||b.breakBefore||b.speedKph<2||(bothMoving&&a.speedKph<2))return null;
 const seconds=(b.timestamp-a.timestamp)/1000,meters=distance(a,b);
 if(seconds<20||seconds>300||meters<minimum||meters/seconds>limit)return null;
 if(!bothMoving&&meters/seconds>3*Math.max(1,(a.speedKph+b.speedKph)/7.2))return null;
 return {at:a.timestamp,confirmedAt:b.timestamp,meters};
}
