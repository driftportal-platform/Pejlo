import {ensureHandoffs} from './handoffs.js';
import {ensureSnooze} from './snooze.js';
import {archiveEvent} from './archive.js';
import {cleanProfile} from '../../packages/shared/profiles.js';
import {once} from './schema.js';
import {notificationPayload} from './messages.js';
const ROLES=['editor','viewer'];
export const canEdit=access=>!!access&&(access.owner||access.role==='editor');
export function ensureFamily(db){return once(db,'family',async()=>{
 for(const q of [
 'CREATE TABLE IF NOT EXISTS pejlo_profiles(identifier TEXT PRIMARY KEY,owner_uid TEXT NOT NULL,profile TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1)',
 'CREATE TABLE IF NOT EXISTS pejlo_members(identifier TEXT NOT NULL,uid TEXT NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL DEFAULT \'editor\',PRIMARY KEY(identifier,uid))',
 'CREATE TABLE IF NOT EXISTS pejlo_invites(hash TEXT PRIMARY KEY,identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,email TEXT NOT NULL,expires INTEGER NOT NULL,role TEXT NOT NULL DEFAULT \'editor\')',
 'CREATE INDEX IF NOT EXISTS pejlo_members_uid ON pejlo_members(uid)'
 ])await db.prepare(q).run();
 // Tables created before roles existed get the column once; existing members keep editing rights.
 for(const q of ['ALTER TABLE pejlo_members ADD COLUMN role TEXT NOT NULL DEFAULT \'editor\'','ALTER TABLE pejlo_invites ADD COLUMN role TEXT NOT NULL DEFAULT \'editor\''])try{await db.prepare(q).run();}catch(e){if(!/duplicate column/i.test(String(e?.message)))throw e;}
});}
export async function trackerAccess(db,identifier,uid){
 const owned=await db.prepare('SELECT identifier FROM trackers WHERE identifier = ? AND owner_uid = ?').bind(identifier,uid).first();
 if(owned)return {owner:true,role:'owner'};
 await ensureFamily(db);
 const shared=await db.prepare('SELECT m.identifier,m.role FROM pejlo_members m JOIN trackers t ON t.identifier=m.identifier JOIN pejlo_profiles p ON p.identifier=t.identifier AND p.owner_uid=t.owner_uid WHERE m.identifier=? AND m.uid=?').bind(identifier,uid).first();
 return shared?{owner:false,role:ROLES.includes(shared.role)?shared.role:'viewer'}:null;
}
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
export async function familyAPI(db,account,input,hashCode){
 await ensureFamily(db);const uid=account.localId;
 if(input===null){
  const rows=await db.prepare('SELECT p.*,CASE WHEN p.owner_uid=? THEN 1 ELSE 0 END AS is_owner,(SELECT m2.role FROM pejlo_members m2 WHERE m2.identifier=p.identifier AND m2.uid=?) AS my_role FROM pejlo_profiles p JOIN trackers t ON t.identifier=p.identifier AND t.owner_uid=p.owner_uid WHERE p.owner_uid=? OR EXISTS(SELECT 1 FROM pejlo_members m WHERE m.identifier=p.identifier AND m.uid=?)').bind(uid,uid,uid,uid).all();
  const profiles=[];
  for(const row of rows.results){const members=row.is_owner?(await db.prepare('SELECT uid,email,role FROM pejlo_members WHERE identifier=?').bind(row.identifier).all()).results:[];const invites=row.is_owner?(await db.prepare('SELECT email,expires,role FROM pejlo_invites WHERE identifier=? AND expires>?').bind(row.identifier,Date.now()).all()).results:[];profiles.push({profile:JSON.parse(row.profile),revision:row.revision,owner:!!row.is_owner,role:row.is_owner?'owner':(ROLES.includes(row.my_role)?row.my_role:'viewer'),members,invites});}
  return {profiles};
 }
 if(input.action==='join'){
  if(typeof input.code!=='string'||!/^\w{32}$/.test(input.code))fail(400,'Kontrollér invitationskoden.');
  const hash=await hashCode(input.code),email=account.email?.toLowerCase();
  // One-use claim and membership assignment are a single SQL statement.
  const invite=await db.prepare('SELECT i.* FROM pejlo_invites i JOIN trackers t ON t.identifier=i.identifier AND t.owner_uid=i.owner_uid WHERE i.hash=? AND i.email=? AND i.expires>?').bind(hash,email||'',Date.now()).first();
  if(!invite)fail(400,'Invitationen er udløbet, brugt eller til en anden e-mail.');
  const joined=await db.prepare('INSERT INTO pejlo_members(identifier,uid,email,role) SELECT identifier,?,email,role FROM pejlo_invites WHERE hash=? AND expires>? AND email=? ON CONFLICT(identifier,uid) DO NOTHING RETURNING identifier').bind(uid,hash,Date.now(),email).first();
  if(!joined)fail(409,'Invitationen kunne ikke bruges.');
  await db.prepare('DELETE FROM pejlo_invites WHERE hash=?').bind(hash).run();return {joined:true};
 }
 if(typeof input.identifier!=='string')fail(400,'Vælg en tracker.');
 const access=await trackerAccess(db,input.identifier,uid);if(!access)fail(403,'Du har ikke adgang til denne tracker.');
 if(input.action==='save'){
  if(!canEdit(access))fail(403,'Du har kun læseadgang til denne profil. Ejeren kan give dig redigeringsret.');
  const profile=cleanProfile(input.profile);
  if(!profile||profile.trackerId!==input.identifier)fail(400,'Profilen er ugyldig.');
  const existing=await db.prepare('SELECT * FROM pejlo_profiles WHERE identifier=?').bind(input.identifier).first();
  if(!existing&&(!access.owner||input.revision!==0))fail(409,'Hent den nyeste profil og prøv igen.');
  if(existing)profile.id=JSON.parse(existing.profile).id;
  const owner=existing?.owner_uid||uid,expected=existing?input.revision:0,serialized=JSON.stringify(profile);
  const mutation=existing?db.prepare('UPDATE pejlo_profiles SET profile=?,revision=revision+1 WHERE identifier=? AND revision=? RETURNING revision').bind(serialized,input.identifier,expected):db.prepare('INSERT OR IGNORE INTO pejlo_profiles(identifier,owner_uid,profile,revision) VALUES(?,?,?,1) RETURNING revision').bind(input.identifier,owner,serialized);
  const fence=db.prepare("INSERT INTO pejlo_fences(identifier,owner_uid,name,config,enabled) SELECT identifier,owner_uid,?,?,? FROM pejlo_profiles WHERE identifier=? AND revision=? AND profile=? ON CONFLICT(identifier) DO UPDATE SET name=excluded.name,config=excluded.config,enabled=excluded.enabled,state=CASE WHEN config=excluded.config AND enabled=excluded.enabled THEN state ELSE '{}' END,checked_at=0").bind(profile.fencePresets.find(f=>f.id===profile.activeFenceId)?.name||profile.name,JSON.stringify({...profile.home,areaId:profile.activeFenceId}),profile.geofenceEnabled&&profile.homeConfirmed?1:0,input.identifier,expected+1,serialized);
  const results=await db.batch([mutation,fence]);
  const updated=results[0].results?.[0];if(!updated)fail(409,'En anden har ændret profilen. Den nyeste udgave hentes; prøv igen.');
  if(existing&&!access.owner)await notifyOwnerOfAreaChange(db,input.identifier,existing,profile,account);
  return updated;
 }
 if(input.action==='leave'){
  if(access.owner)fail(400,'Ejeren kan ikke forlade sin egen profil.');
  await db.prepare('DELETE FROM pejlo_members WHERE identifier=? AND uid=?').bind(input.identifier,uid).run();
  await db.prepare('DELETE FROM pejlo_alerts WHERE identifier=? AND uid=?').bind(input.identifier,uid).run();return {left:true};
 }
 if(!access.owner)fail(403,'Kun ejeren kan administrere deling.');
 if(input.action==='invite'){
  const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email===account.email?.toLowerCase())fail(400,'Skriv den anden brugers e-mail.');
  if(!await db.prepare('SELECT identifier FROM pejlo_profiles WHERE identifier=?').bind(input.identifier).first())fail(400,'Gem profilen før du inviterer.');
  const count=await db.prepare('SELECT COUNT(*) AS n FROM pejlo_members WHERE identifier=?').bind(input.identifier).first();if(count.n>=10)fail(400,'Der kan deles med højst 10 brugere.');
  const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
  await db.prepare('DELETE FROM pejlo_invites WHERE identifier=? AND (email=? OR expires<?)').bind(input.identifier,email,Date.now()).run();
  const role=input.role===undefined?'editor':input.role;if(!ROLES.includes(role))fail(400,'Vælg om modtageren må redigere eller kun se.');
  await db.prepare('INSERT INTO pejlo_invites(hash,identifier,owner_uid,email,expires,role) VALUES(?,?,?,?,?,?)').bind(await hashCode(code),input.identifier,uid,email,Date.now()+7*86400000,role).run();return {code,role};
 }
 if(input.action==='setrole'){
  if(!ROLES.includes(input.role)||typeof input.uid!=='string')fail(400,'Vælg en gyldig adgang.');
  const changed=await db.prepare('UPDATE pejlo_members SET role=? WHERE identifier=? AND uid=? RETURNING uid').bind(input.role,input.identifier,input.uid).first();
  if(!changed)fail(404,'Brugeren har ikke adgang til profilen.');return {role:input.role};
 }
 if(input.action==='revoke'){
  await ensureSnooze(db);await db.prepare('DELETE FROM pejlo_snooze WHERE identifier=? AND uid=?').bind(input.identifier,String(input.uid||'')).run();
  await db.prepare('DELETE FROM pejlo_members WHERE identifier=? AND uid=?').bind(input.identifier,String(input.uid||'')).run();
  await db.prepare('DELETE FROM pejlo_invites WHERE identifier=? AND email=?').bind(input.identifier,String(input.email||'').toLowerCase()).run();
  await db.prepare('DELETE FROM pejlo_alerts WHERE identifier=? AND uid=?').bind(input.identifier,String(input.uid||'')).run();return {revoked:true};
 }
 if(input.action==='delete'){
  await ensureHandoffs(db);await db.prepare('DELETE FROM pejlo_handoffs WHERE identifier=?').bind(input.identifier).run();
  await ensureSnooze(db);await db.prepare('DELETE FROM pejlo_snooze WHERE identifier=?').bind(input.identifier).run();
  await db.prepare('UPDATE pejlo_fences SET enabled=0 WHERE identifier=?').bind(input.identifier).run();
  await db.prepare('DELETE FROM pejlo_alerts WHERE identifier=?').bind(input.identifier).run();
  await db.prepare('DELETE FROM pejlo_events WHERE identifier=?').bind(input.identifier).run();
  await db.prepare('DELETE FROM pejlo_profiles WHERE identifier=?').bind(input.identifier).run();
  await db.prepare('DELETE FROM pejlo_members WHERE identifier=?').bind(input.identifier).run();
  await db.prepare('DELETE FROM pejlo_invites WHERE identifier=?').bind(input.identifier).run();return {deleted:true};
 }
 fail(400,'Ukendt handling.');
}

// A shared editor changing the monitored area is reported to the owner (best effort; never blocks the save).
const areaOf=p=>JSON.stringify([p.home,!!p.geofenceEnabled,p.activeFenceId??null,p.fencePresets??[]]);
async function notifyOwnerOfAreaChange(db,identifier,existing,profile,account){
 try{
  const before=JSON.parse(existing.profile);if(areaOf(before)===areaOf(profile))return;
  const payload=notificationPayload('fencechange',identifier,{name:profile.name,who:account.email,disabled:!!before.geofenceEnabled&&!profile.geofenceEnabled});
  const now=Date.now(),id=['fencechange',identifier,now].join(':');
  await archiveEvent(db,{id,identifier,uid:existing.owner_uid,kind:'fencechange',payload,createdAt:now,area:{home:profile.home,name:profile.fencePresets.find(f=>f.id===profile.activeFenceId)?.name||''}});
  await db.prepare('INSERT OR IGNORE INTO pejlo_events(id,identifier,uid,kind,payload,created_at) VALUES(?,?,?,?,?,?)').bind(['fencechange',identifier,now].join(':'),identifier,existing.owner_uid,'fencechange',JSON.stringify(payload),now).run();
 }catch{/* notification tables may not exist yet; the save already succeeded */}
}
