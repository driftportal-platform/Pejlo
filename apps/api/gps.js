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
export function gpsPoint(raw){
 const timestamp=Date.parse(raw?.fixTime);
 if(raw?.valid!==true||!validPoint({lat:raw.latitude,lon:raw.longitude})||!Number.isFinite(timestamp)||timestamp>Date.now()+60000)return null;
 return {lat:raw.latitude,lon:raw.longitude,timestamp,accuracy:Number.isFinite(raw.accuracy)&&raw.accuracy>0?raw.accuracy:null,battery:Number.isFinite(raw.attributes?.batteryLevel)&&raw.attributes.batteryLevel>=0&&raw.attributes.batteryLevel<=100?raw.attributes.batteryLevel:null,valid:true};
}
