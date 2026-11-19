import {once} from './schema.js';

export function ensureLocationAccess(db){
 return once(db,'location-access',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_location_access(uid TEXT PRIMARY KEY,enabled INTEGER NOT NULL CHECK(enabled IN (0,1)))').run());
}
export async function locationEnabled(db,uid){
 await ensureLocationAccess(db);
 const row=await db.prepare('SELECT enabled FROM pejlo_location_access WHERE uid=?').bind(uid).first();
 return row?.enabled===1;
}
export async function setLocationAccess(db,uid,enabled){
 await ensureLocationAccess(db);
 await db.prepare('INSERT INTO pejlo_location_access(uid,enabled) VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET enabled=excluded.enabled').bind(uid,+enabled).run();
}
