import {once} from './schema.js';
import {normalizeAccountState} from '../../packages/shared/account-state.js';
import {ensureFamily,trackerAccess,familyAPI} from './family.js';
import {ensureNotifications} from './notifications.js';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function ensureAccountState(db){return once(db,'account-state',async()=>{
 await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_account_state(uid TEXT PRIMARY KEY,state TEXT NOT NULL,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_state_imports(uid TEXT PRIMARY KEY,source TEXT NOT NULL,snapshot TEXT NOT NULL,created_at INTEGER NOT NULL)').run();
});}
export function decodeFirestore(value,depth=0){
 if(depth>30)throw Error('For dybe profildata.');
 if('nullValue' in value)return null;
 if('stringValue' in value)return value.stringValue;
 if('booleanValue' in value)return value.booleanValue;
 if('integerValue' in value||'doubleValue' in value)return Number(value.integerValue??value.doubleValue);
 if(value.arrayValue)return (value.arrayValue.values||[]).map(v=>decodeFirestore(v,depth+1));
 if(value.mapValue)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,decodeFirestore(v,depth+1)]));
 return null;
}
// One-time import with the authenticated user's Firebase ID token.
export async function legacyAccount({uid,token,projectId,fetcher=fetch}){
 const url='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+'/databases/(default)/documents/users/'+encodeURIComponent(uid)+'/private/state';
 const r=await fetcher(url,{headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(r.status===404)return null;
 if(!r.ok)fail(503,'De eksisterende profiler kunne ikke overføres. Prøv igen; ingen data er slettet.');
 const text=await r.text();if(text.length>2000000)fail(400,'De eksisterende profildata er for store.');
 const doc=JSON.parse(text);return decodeFirestore({mapValue:{fields:doc.fields||{}}});
}
// Linked profiles live only in pejlo_profiles. Private state cannot overwrite them.
async function privateState(db,uid,raw){
 const value=normalizeAccountState(raw),profiles=[];
 for(const p of value.profiles){
  if(!p.trackerId){profiles.push(p);continue;}
  if(!await trackerAccess(db,p.trackerId,uid))fail(403,'Du har ikke adgang til en af profilerne. Hent profilerne igen.');
  const canonical=await db.prepare('SELECT identifier FROM pejlo_profiles WHERE identifier=?').bind(p.trackerId).first();
  if(!canonical)fail(409,'Gem den tilknyttede profil før kontoindstillingerne.');
 }
 return {profiles,activeId:value.activeId,mapKey:''};
}
async function publicState(db,uid,row){
 const saved=JSON.parse(row.state),profiles=normalizeAccountState(saved).profiles.filter(p=>!p.trackerId);
 const linked=await db.prepare('SELECT p.profile FROM pejlo_profiles p JOIN trackers t ON t.identifier=p.identifier AND t.owner_uid=p.owner_uid WHERE p.owner_uid=? OR EXISTS(SELECT 1 FROM pejlo_members m WHERE m.identifier=p.identifier AND m.uid=?) ORDER BY p.identifier').bind(uid,uid).all();
 const ids=new Set(profiles.map(p=>p.id));
 for(const item of linked.results){const p=normalizeAccountState({profiles:[JSON.parse(item.profile)]}).profiles[0];if(p&&!ids.has(p.id)){ids.add(p.id);profiles.push(p);}}
 return {...normalizeAccountState({...saved,profiles}),revision:row.revision};
}
export async function accountStateAPI({db,uid,input=null,loadLegacy=async()=>null,now=Date.now()}){
 await ensureAccountState(db);await ensureFamily(db);
 let row=await db.prepare('SELECT state,revision FROM pejlo_account_state WHERE uid=?').bind(uid).first();
 if(!row){
  const legacy=await loadLegacy(),normalized=normalizeAccountState(legacy);
  await db.prepare('INSERT OR IGNORE INTO pejlo_state_imports(uid,source,snapshot,created_at) VALUES(?,?,?,?)').bind(uid,legacy?'firestore':'empty',JSON.stringify(legacy??{}),now).run();
  for(const p of normalized.profiles.filter(p=>p.trackerId)){
   const access=await trackerAccess(db,p.trackerId,uid);
   if(!access){p.trackerId='';continue;}
   const exists=await db.prepare('SELECT identifier FROM pejlo_profiles WHERE identifier=?').bind(p.trackerId).first();
   if(!exists&&access.owner){await ensureNotifications(db);await familyAPI(db,{localId:uid},{action:'save',identifier:p.trackerId,profile:p,revision:0});}
  }
  const seed=await privateState(db,uid,normalized);
  await db.prepare('INSERT OR IGNORE INTO pejlo_account_state(uid,state,revision,updated_at) VALUES(?,?,0,?)').bind(uid,JSON.stringify(seed),now).run();
  row=await db.prepare('SELECT state,revision FROM pejlo_account_state WHERE uid=?').bind(uid).first();
 }
 if(input){
  if(!Number.isSafeInteger(input.revision)||input.revision<0||!input.state||!Array.isArray(input.state.profiles)||input.state.profiles.length>50)fail(400,'Ugyldige profildata.');
  if(normalizeAccountState(input.state).profiles.length!==input.state.profiles.length)fail(400,'En profil er ugyldig eller optræder flere gange. Hent profilerne igen.');
  const state=await privateState(db,uid,input.state);
  const changed=await db.prepare('UPDATE pejlo_account_state SET state=?,revision=revision+1,updated_at=? WHERE uid=? AND revision=? RETURNING state,revision').bind(JSON.stringify(state),now,uid,input.revision).first();
  if(!changed)fail(409,'Data er ændret på en anden enhed. Hent profilerne igen og prøv ændringen.');
  row=changed;
 }
 return publicState(db,uid,row);
}
