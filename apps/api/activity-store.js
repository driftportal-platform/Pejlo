import {ensureRestSessions} from './rest-session-store.js';
import {once} from './schema.js';
import {ensureRest} from './rest-store.js';
export function ensureActivity(db){return once(db,'activity',async()=>{
 await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_activity_settings(owner_uid TEXT NOT NULL,scope TEXT NOT NULL,goal_km REAL,revision INTEGER NOT NULL,PRIMARY KEY(owner_uid,scope))').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_activity_days(owner_uid TEXT NOT NULL,scope TEXT NOT NULL,day TEXT NOT NULL,km REAL,rest_hours REAL,note TEXT NOT NULL,goal_km REAL,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL,actor_uid TEXT,PRIMARY KEY(owner_uid,scope,day))').run();
});}
export async function removeActivityProfile(db,uid,id){
 await ensureActivity(db);await ensureActivityGps(db);await ensureRest(db);await ensureRestSessions(db);
 for(const table of ['pejlo_activity_days','pejlo_activity_settings','pejlo_activity_gps','pejlo_rest_settings'])await db.prepare('DELETE FROM '+table+' WHERE owner_uid=? AND scope=?').bind(uid,'profile:'+id).run();
 for(const table of ['pejlo_rest_reports','pejlo_rest_wear','pejlo_rest_sessions','pejlo_rest_session_settings'])await db.prepare('DELETE FROM '+table+' WHERE owner_uid=? AND profile_id=?').bind(uid,id).run();
}
export function ensureActivityGps(db){return once(db,'activity-gps',async()=>{
 await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_activity_gps(owner_uid TEXT NOT NULL,scope TEXT NOT NULL,day TEXT NOT NULL,context TEXT NOT NULL,summary TEXT NOT NULL,checked_at INTEGER NOT NULL,PRIMARY KEY(owner_uid,scope,day))').run();
});}
