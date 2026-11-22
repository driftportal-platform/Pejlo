import {cleanAccessPoints} from '../../packages/shared/home-wifi.js';
import {validPoint} from '../../packages/shared/geo.js';
import {advanceBattery} from '../../packages/shared/battery.js';
import {once} from './schema.js';
import {filterGps} from '../../packages/shared/gps-filter.js';
export function ensureGps(db){return once(db,'gps-filter',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_gps_filter(identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,state TEXT NOT NULL,PRIMARY KEY(identifier,owner_uid))').run());}
export async function trustedGps(db,identifier,owner,points,type,home,batteryReport,source){
 identifier='gps-only-v1:'+(source?source+':':'')+identifier;
 await ensureGps(db);
 await db.prepare("INSERT OR IGNORE INTO pejlo_gps_filter(identifier,owner_uid,state) VALUES(?,?,'{}')").bind(identifier,owner).run();
 for(let n=0;n<4;n++){
  const row=await db.prepare('SELECT state FROM pejlo_gps_filter WHERE identifier=? AND owner_uid=?').bind(identifier,owner).first();
  if(!row)throw Error('GPS-filteret kunne ikke læses.');
  const result=filterGps(points,type,JSON.parse(row.state),home);
  if(batteryReport){
   const reading=advanceBattery(result.state.batteryReading,batteryReport.level,batteryReport.timestamp);
   if(reading)result.state.batteryReading=reading;
  }
  const changed=await db.prepare('UPDATE pejlo_gps_filter SET state=? WHERE identifier=? AND owner_uid=? AND state=? RETURNING identifier').bind(JSON.stringify(result.state),identifier,owner,row.state).first();
  if(changed)return result.state;
 }
 throw Error('GPS-filteret er optaget. Prøv igen.');
}
function batteryLevel(raw){
 const level=raw?.attributes?.batteryLevel;
 return Number.isFinite(level)&&level>=0&&level<=100?level:null;
}
function signalInteger(value,max=255){return Number.isInteger(value)&&value>=0&&value<=max?value:null;}
function cellTowers(raw){
 const towers=raw?.network?.cellTowers;
 if(!Array.isArray(towers))return [];
 return towers.slice(0,8).map(t=>({
  mcc:signalInteger(t?.mobileCountryCode,999),mnc:signalInteger(t?.mobileNetworkCode,999),
  lac:signalInteger(t?.locationAreaCode,16777215),cid:signalInteger(t?.cellId,68719476735)
 })).filter(t=>Object.values(t).every(v=>v!==null));
}
export function trackerTelemetry(raw,now=Date.now()){
 const serverTime=Date.parse(raw?.serverTime);
 const fixTime=Date.parse(raw?.fixTime);
 const receivedAt=Number.isFinite(serverTime)&&serverTime<=now+60000?serverTime:null;
 const charge=raw?.attributes?.charge;
 const wifiAccessPoints=cleanAccessPoints(raw?.network?.wifiAccessPoints);
 const deviceTime=Date.parse(raw?.deviceTime);
 const wifiMeasuredAt=!wifiAccessPoints.length||receivedAt==null||deviceTime>now+10000?null:(Number.isFinite(deviceTime)?Math.min(receivedAt,deviceTime):receivedAt);
 return {
  battery:batteryLevel(raw),
  charging:typeof charge==='boolean'?charge:null,
  receivedAt,
  satellites:signalInteger(raw?.attributes?.sat),
  rssi:signalInteger(raw?.attributes?.rssi),
  rssiMax:raw?.protocol==='jt808'?31:null,
  cellTowers:cellTowers(raw),
  wifiAccessPoints,
  wifiMeasuredAt,
  gpsClockAhead:Number.isFinite(fixTime)&&fixTime>(receivedAt??now)+60000
 };
}
export function gpsPoint(raw){
 const timestamp=Date.parse(raw?.fixTime);
 if(raw?.attributes?.approximate===true||raw?.outdated===true)return null;
 if((raw?.latitude===0&&raw?.longitude===0)||raw?.valid!==true||!validPoint({lat:raw.latitude,lon:raw.longitude})||!Number.isFinite(timestamp)||timestamp>Date.now()+60000)return null;
 return {lat:raw.latitude,lon:raw.longitude,timestamp,accuracy:Number.isFinite(raw.accuracy)&&raw.accuracy>0?raw.accuracy:null,battery:batteryLevel(raw),valid:true};
}

export function approximatePoint(raw,now=Date.now()){
 const timestamp=Date.parse(raw?.fixTime),receivedAt=Date.parse(raw?.serverTime);
 if(raw?.attributes?.approximate!==true||raw?.valid!==true||
    !validPoint({lat:raw.latitude,lon:raw.longitude})||(raw.latitude===0&&raw.longitude===0)||
    !Number.isFinite(raw.accuracy)||raw.accuracy<=0||raw.accuracy>200000||
    !Number.isFinite(timestamp)||timestamp>now+60000||now-timestamp>300000||
    !Number.isFinite(receivedAt)||receivedAt>now+60000||now-receivedAt>300000)return null;
 return {lat:raw.latitude,lon:raw.longitude,timestamp,receivedAt,accuracy:raw.accuracy,approximate:true};
}
