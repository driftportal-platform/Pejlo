import {once} from './schema.js';
export const ensureArchive=db=>once(db,'archive',async()=>{
 await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_alarm_history(id TEXT PRIMARY KEY,identifier TEXT NOT NULL,uid TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,fix_time INTEGER,area TEXT,push_status TEXT NOT NULL)').run();
 await db.prepare('CREATE INDEX IF NOT EXISTS pejlo_alarm_history_user ON pejlo_alarm_history(uid,identifier,created_at,id)').run();
});
export async function archiveEvent(db,{id,identifier,uid,kind,payload,createdAt=Date.now(),fixTime=null,area=null,status='pending'}){
 await ensureArchive(db);
 await db.prepare('INSERT OR IGNORE INTO pejlo_alarm_history(id,identifier,uid,kind,payload,created_at,fix_time,area,push_status) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,identifier,uid,kind,JSON.stringify(payload),createdAt,Number.isFinite(fixTime)?fixTime:null,area?JSON.stringify(area):null,status).run();
}
export async function archiveStatus(db,id,status){await db.prepare('UPDATE pejlo_alarm_history SET push_status=? WHERE id=?').bind(status,id).run();}
export async function listAlarms(db,identifier,uid,before=Date.now()+1,beforeId='~'){
 await ensureArchive(db);
 const rows=await db.prepare('SELECT id,kind,payload,created_at,fix_time,area,push_status FROM pejlo_alarm_history WHERE uid=? AND identifier=? AND created_at>=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 101').bind(uid,identifier,Date.now()-90*86400000,before,before,beforeId).all();
 const page=rows.results.slice(0,100),last=page.at(-1);
 return {events:page.map(r=>({...r,payload:JSON.parse(r.payload),area:r.area?JSON.parse(r.area):null})),next:rows.results.length>100?{before:last.created_at,beforeId:last.id}:null};
}
