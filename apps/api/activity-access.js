import {ensureFamily,trackerAccess,canEdit} from './family.js';
import {animalType} from '../../packages/shared/activity.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export async function activityAccess(db,uid,v,input=null){
 if(typeof v.profileId!=='string'||!v.profileId||v.profileId.length>100||(!animalType(v.type)&&input?.action!=='clear'))fail(400,'Vælg en dyreprofil.');
 let owner=uid,scope='profile:'+v.profileId,editable=true,profile=null;
 if(v.identifier){
  if(typeof v.identifier!=='string'||!/^[A-Za-z0-9_-]{4,100}$/.test(v.identifier))fail(400,'Ugyldig tracker.');
  await ensureFamily(db);const access=await trackerAccess(db,v.identifier,uid);if(!access)fail(403,'Du har ikke adgang til denne dyreprofil.');
  const row=await db.prepare('SELECT p.profile,p.owner_uid FROM pejlo_profiles p JOIN trackers t ON t.identifier=p.identifier AND t.owner_uid=p.owner_uid WHERE p.identifier=?').bind(v.identifier).first();
  try{profile=JSON.parse(row?.profile);}catch{}
  if(!profile||profile.id!==v.profileId||!animalType(profile.type)||profile.type!==v.type)fail(409,'Profilen er ændret. Hent den igen.');
  owner=row.owner_uid;scope='profile:'+profile.id;editable=canEdit(access);
 }
 return {owner,scope,editable,profile};
}
