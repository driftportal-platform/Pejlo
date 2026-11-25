import {registeredRest} from './rest-session-store.js';
import {once} from './schema.js';
import {cleanAttachment} from '../../packages/shared/attachment.js';
import {animalType} from '../../packages/shared/activity.js';
import {historyRange} from '../../packages/shared/history.js';
import {estimateRest,REST_WINDOW} from '../../packages/shared/rest-estimate.js';
import {wornQuietIntervals} from '../../packages/shared/rest-observation.js';

export function ensureRest(db){return once(db,'rest-estimates',async()=>{
 for(const sql of [
  'CREATE TABLE IF NOT EXISTS pejlo_rest_settings(owner_uid TEXT NOT NULL,scope TEXT NOT NULL,enabled INTEGER NOT NULL,PRIMARY KEY(owner_uid,scope))',
  'CREATE TABLE IF NOT EXISTS pejlo_rest_wear(identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,profile_id TEXT NOT NULL,revision INTEGER NOT NULL,at INTEGER NOT NULL,worn INTEGER NOT NULL,PRIMARY KEY(identifier,owner_uid,profile_id,revision))',
  'CREATE TABLE IF NOT EXISTS pejlo_rest_reports(identifier TEXT NOT NULL,source TEXT NOT NULL,owner_uid TEXT NOT NULL,profile_id TEXT NOT NULL,at INTEGER NOT NULL,kind TEXT NOT NULL,charging INTEGER,motion INTEGER,PRIMARY KEY(identifier,source,owner_uid,profile_id,at,kind))'
 ])await db.prepare(sql).run();
});}

export function wearStatement(db,profile,owner,revision,at,serialized){
 const worn=cleanAttachment(profile.attachment,profile.trackerId,at)?.state==='worn';
 return db.prepare('INSERT OR IGNORE INTO pejlo_rest_wear(identifier,owner_uid,profile_id,revision,at,worn) SELECT identifier,owner_uid,?,?,?,? FROM pejlo_profiles WHERE identifier=? AND owner_uid=? AND revision=? AND profile=?').bind(profile.id,revision,at,worn?1:0,profile.trackerId,owner,revision,serialized);
}

export async function archiveRestReports(env,identifier,events,now){
 await ensureRest(env.DB);
 const row=await env.DB.prepare('SELECT p.profile,p.owner_uid FROM pejlo_profiles p JOIN trackers t ON t.identifier=p.identifier AND t.owner_uid=p.owner_uid WHERE p.identifier=?').bind(identifier).first();
 let profile;try{profile=JSON.parse(row?.profile);}catch{}
 if(!profile||!animalType(profile.type))return;
 const worn=cleanAttachment(profile.attachment,identifier,now)?.state==='worn';
 // Bootstrap existing profiles at activation time, never backdate their worn state.
 await env.DB.prepare('INSERT OR IGNORE INTO pejlo_rest_wear(identifier,owner_uid,profile_id,revision,at,worn) VALUES(?,?,?,0,?,?)').bind(identifier,row.owner_uid,profile.id,now,worn?1:0).run();
 for(const e of events)await env.DB.prepare('INSERT OR IGNORE INTO pejlo_rest_reports(identifier,source,owner_uid,profile_id,at,kind,charging,motion) VALUES(?,?,?,?,?,?,?,?)').bind(identifier,env.TRACCAR_SOURCE||'environment',row.owner_uid,profile.id,e.at,e.kind,e.charging,e.motion??null).run();
 await env.DB.prepare('DELETE FROM pejlo_rest_reports WHERE identifier=? AND owner_uid=? AND at<?').bind(identifier,row.owner_uid,now-90*86400000).run();
}

export async function automaticRest(db,owner,scope,profile,source,from,to,now,gpsIntervals=[]){
 await ensureRest(db);
 const setting=await db.prepare('SELECT enabled FROM pejlo_rest_settings WHERE owner_uid=? AND scope=?').bind(owner,scope).first();
 const enabled=setting?.enabled!==0;
 if(!profile)return {autoRestEnabled:enabled,restDays:[],restLimited:false};
 const range=historyRange(from,to,now);
 const registered=await registeredRest(db,owner,profile,source,range.from,range.to,now);
 const registeredDays=estimateRest([],from,to,now,registered);
 const annotate=days=>days.map(d=>({...d,registeredRestMinutes:registeredDays.find(r=>r.day===d.day)?.estimatedRestMinutes||0}));
 if(!enabled)return {autoRestEnabled:false,restDays:registered.length?annotate(registeredDays):[],restLimited:false};
 const args=[profile.trackerId,owner,profile.id];
 const wear=(await db.prepare('SELECT at,worn FROM pejlo_rest_wear WHERE identifier=? AND owner_uid=? AND profile_id=? AND at<=? ORDER BY at,revision').bind(...args,range.to).all()).results;
 const records=(await db.prepare('SELECT at,kind,charging,motion FROM pejlo_rest_reports WHERE identifier=? AND owner_uid=? AND profile_id=? AND source=? AND at>=? AND at<=? ORDER BY at LIMIT 50001').bind(...args,source||'environment',range.from-REST_WINDOW,range.to).all()).results;
 if(records.length>50000)return {autoRestEnabled:enabled,restDays:registered.length?annotate(registeredDays):[],restLimited:true};
 const events=[...wear.map(w=>({at:w.at,kind:w.worn?'wear_on':'wear_off'})),...records.map(e=>({...e,charging:e.charging===null?null:e.charging===1,motion:e.motion===null?null:e.motion===1}))];
 return {autoRestEnabled:enabled,restDays:annotate(estimateRest(events,from,to,now,[...wornQuietIntervals(gpsIntervals,wear,range.to),...registered])),restLimited:false};
}
