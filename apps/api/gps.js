import {validPoint} from '../../packages/shared/geo.js';
import {once} from './schema.js';
import {filterGps} from '../../packages/shared/gps-filter.js';
export function ensureGps(db){return once(db,'gps-filter',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_gps_filter(identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,state TEXT NOT NULL,PRIMARY KEY(identifier,owner_uid))').run());}
export async function trustedGps(db,identifier,owner,points,type,home){
 await ensureGps(db);
 await db.prepare("INSERT OR IGNORE INTO pejlo_gps_filter(identifier,owner_uid,state) VALUES(?,?,'{}')").bind(identifier,owner).run();
 for(let n=0;n<4;n++){
  const row=await db.prepare('SELECT state FROM pejlo_gps_filter WHERE identifier=? AND owner_uid=?').bind(identifier,owner).first();
  if(!row)throw Error('GPS-filteret kunne ikke læses.');
  const result=filterGps(points,type,JSON.parse(row.state),home);
  const changed=await db.prepare('UPDATE pejlo_gps_filter SET state=? WHERE identifier=? AND owner_uid=? AND state=? RETURNING identifier').bind(JSON.stringify(result.state),identifier,owner,row.state).first();
  if(changed)return result.state;
 }
 throw Error('GPS-filteret er optaget. Prøv igen.');
}
function batteryLevel(raw){
 const level=raw?.attributes?.batteryLevel;
 return Number.isFinite(level)&&level>=0&&level<=100?level:null;
}
export function trackerTelemetry(raw,now=Date.now()){
 const serverTime=Date.parse(raw?.serverTime);
 const fixTime=Date.parse(raw?.fixTime);
 const receivedAt=Number.isFinite(serverTime)&&serverTime<=now+60000?serverTime:null;
 const charge=raw?.attributes?.charge;
 return {
  battery:batteryLevel(raw),
  charging:typeof charge==='boolean'?charge:null,
  receivedAt,
  gpsClockAhead:Number.isFinite(fixTime)&&fixTime>(receivedAt??now)+60000
 };
}
export function gpsPoint(raw){
 const timestamp=Date.parse(raw?.fixTime);
 if(raw?.valid!==true||!validPoint({lat:raw.latitude,lon:raw.longitude})||!Number.isFinite(timestamp)||timestamp>Date.now()+60000)return null;
 return {lat:raw.latitude,lon:raw.longitude,timestamp,accuracy:Number.isFinite(raw.accuracy)&&raw.accuracy>0?raw.accuracy:null,battery:batteryLevel(raw),valid:true};
}
