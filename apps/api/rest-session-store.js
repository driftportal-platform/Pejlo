import {once} from './schema.js';
export const ensureRestSessions=db=>once(db,'rest-sessions',async()=>{
 await db.prepare(`CREATE TABLE IF NOT EXISTS pejlo_rest_sessions(id TEXT PRIMARY KEY,identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,profile_id TEXT NOT NULL,source TEXT NOT NULL,started_at INTEGER NOT NULL,ended_at INTEGER,reason TEXT NOT NULL DEFAULT '',actor_uid TEXT,checked_at INTEGER NOT NULL DEFAULT 0,last_fix INTEGER,samples TEXT NOT NULL DEFAULT '[]')`).run();
 await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS pejlo_rest_one_active ON pejlo_rest_sessions(identifier,owner_uid,profile_id,source) WHERE ended_at IS NULL').run();
 for(const [column,initial] of [['reviewed_until',0],['history_checked_at',0],['distance_metres',40],['movement_since',0]])try{await db.prepare('ALTER TABLE pejlo_rest_sessions ADD COLUMN '+column+' INTEGER NOT NULL DEFAULT '+initial).run();}catch(e){if(!/duplicate column/i.test(String(e.message)))throw e;}
 await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_rest_session_settings(identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,profile_id TEXT NOT NULL,source TEXT NOT NULL,distance_metres INTEGER NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(identifier,owner_uid,profile_id,source))').run();
});
export async function registeredRest(db,owner,profile,source,from,to,now){
 if(!profile)return [];
 await ensureRestSessions(db);
 const rows=await db.prepare('SELECT started_at,ended_at FROM pejlo_rest_sessions WHERE identifier=? AND owner_uid=? AND profile_id=? AND source=? AND started_at<? AND (ended_at IS NULL OR ended_at>?) ORDER BY started_at LIMIT 5001').bind(profile.trackerId,owner,profile.id,source||'environment',to,from).all();
 if(rows.results.length>5000)throw Error('Vælg en kortere hvileperiode.');
 return rows.results.map(r=>[Math.max(from,r.started_at),Math.min(to,r.ended_at??now)]).filter(([a,b])=>b>a);
}
