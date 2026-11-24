import {ensureActivity,removeActivityProfile} from './activity-store.js';
export {ensureActivity} from './activity-store.js';
import {activityAccess} from './activity-access.js';
import {animalType,activityDates,activityNumber} from '../../packages/shared/activity.js';
import {danishDate} from '../../packages/shared/history.js';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export async function activityAPI({db,uid,query,input,now=Date.now()}){
 const v=input||query,{owner,scope,editable}=await activityAccess(db,uid,v,input);
 await ensureActivity(db);
 if(input){
  if(!editable)fail(403,'Du har kun læseadgang til motionshistorikken.');
  if(input.action==='clear'){if(v.identifier)fail(400,'Fjern den tilknyttede profil gennem profildeling.');await removeActivityProfile(db,uid,v.profileId);return {deleted:true};}
  if(!Number.isSafeInteger(input.revision)||input.revision<0)fail(400,'Hent motionshistorikken igen før gemning.');
  const rev=input.revision;let changed;
  if(input.action==='goal'){
   let goal;try{goal=activityNumber(input.goalKm,200,'Kilometermål');}catch(e){fail(400,e.message);}
   if(goal===0)fail(400,'Vælg et mål over 0 km, eller lad feltet være tomt.');
   if(rev===0)changed=await db.prepare('INSERT OR IGNORE INTO pejlo_activity_settings(owner_uid,scope,goal_km,revision) VALUES(?,?,?,1) RETURNING revision').bind(owner,scope,goal).first();
   else changed=await db.prepare('UPDATE pejlo_activity_settings SET goal_km=?,revision=revision+1 WHERE owner_uid=? AND scope=? AND revision=? RETURNING revision').bind(goal,owner,scope,rev).first();
  }else if(['day','delete'].includes(input.action)){
   try{activityDates(input.day,input.day,now);}catch(e){fail(400,e.message);}
   if(input.action==='delete')changed=await db.prepare('DELETE FROM pejlo_activity_days WHERE owner_uid=? AND scope=? AND day=? AND revision=? RETURNING day').bind(owner,scope,input.day,rev).first();
   else{
    let km,rest;try{km=activityNumber(input.km,500,'Kilometer');rest=activityNumber(input.restHours,24,'Hviletimer');}catch(e){fail(400,e.message);}
    if(typeof input.note!=='string'||input.note.length>200)fail(400,'Skriv højst 200 tegn i noten.');
    if(km===null&&rest===null&&!input.note.trim())fail(400,'Registrer kilometer, hvile eller en note.');
    const goal=(await db.prepare('SELECT goal_km FROM pejlo_activity_settings WHERE owner_uid=? AND scope=?').bind(owner,scope).first())?.goal_km??null;
    if(rev===0)changed=await db.prepare(`INSERT OR IGNORE INTO pejlo_activity_days(owner_uid,scope,day,km,rest_hours,note,goal_km,revision,updated_at,actor_uid) VALUES(?,?,?,?,?,?,?,1,?,?) RETURNING revision`).bind(owner,scope,input.day,km,rest,input.note.trim(),goal,now,uid).first();
    else changed=await db.prepare('UPDATE pejlo_activity_days SET km=?,rest_hours=?,note=?,revision=revision+1,updated_at=?,actor_uid=? WHERE owner_uid=? AND scope=? AND day=? AND revision=? RETURNING revision').bind(km,rest,input.note.trim(),now,uid,owner,scope,input.day,rev).first();
   }
  }else fail(400,'Vælg en gyldig motionshandling.');
  if(!changed)fail(409,'Motionsdata er ændret på en anden enhed. Hent historikken igen før du gemmer.');
  return {saved:true,revision:changed.revision??0};
 }
 const from=query.from||danishDate(now),to=query.to||from;
 try{activityDates(from,to,now);}catch(e){fail(400,e.message);}
 const settings=await db.prepare('SELECT goal_km,revision FROM pejlo_activity_settings WHERE owner_uid=? AND scope=?').bind(owner,scope).first();
 const entries=await db.prepare('SELECT day,km,rest_hours,note,goal_km,revision,updated_at FROM pejlo_activity_days WHERE owner_uid=? AND scope=? AND day>=? AND day<=? ORDER BY day').bind(owner,scope,from,to).all();
 return {canEdit:editable,settings:settings||{goal_km:null,revision:0},entries:entries.results,from,to};
}
