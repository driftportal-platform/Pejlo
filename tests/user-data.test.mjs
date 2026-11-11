import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {ensureFamily} from '../apps/api/family.js';
import {ensureNotifications} from '../apps/api/notifications.js';
import {ensureArchive} from '../apps/api/archive.js';
import {ensureSnooze} from '../apps/api/snooze.js';
import {ensureHandoffs} from '../apps/api/handoffs.js';
import {ensureGps} from '../apps/api/gps.js';
import {ensureBilling} from '../apps/api/billing.js';
import {ensureSubscriptions} from '../apps/api/subscriptions.js';
import {ensureMail} from '../apps/api/mail.js';
import {deleteUserData,deleteFirestoreState} from '../apps/api/user-data.js';
import {firebaseConfig} from '../apps/web/src/config/firebase.js';

function database(){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,name TEXT,owner_uid TEXT,code_hash TEXT,claimed_at TEXT)');
 return {raw,prepare(sql){const stmt=raw.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async run(){return stmt.run(...args);},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};}};}};
}
// Every table that holds data about an account, with the column(s) that identify the account.
const owners={pejlo_push:['owner_uid'],pejlo_push_queue:['owner_uid'],pejlo_alerts:['uid'],pejlo_snooze:['uid'],pejlo_alarm_history:['uid'],pejlo_events:['uid'],pejlo_mail_limits:['uid'],pejlo_mail_log:['uid'],pejlo_handoffs:['actor_uid'],pejlo_gps_filter:['owner_uid'],pejlo_fences:['owner_uid'],pejlo_profiles:['owner_uid'],pejlo_members:['uid'],pejlo_invites:['owner_uid'],pejlo_subscription_requests:['uid'],pejlo_subscriptions:['uid'],pejlo_billing:['uid']};
let counter=0;
function insert(raw,table,column,value,extra={}){
 const columns=raw.prepare('PRAGMA table_info('+table+')').all();
 const names=[],values=[];
 for(const c of columns){if(c.name==='id'&&c.type==='INTEGER'&&c.pk)continue;names.push(c.name);values.push(c.name in extra?extra[c.name]:c.name===column?value:/INT/i.test(c.type)?1:'v'+(++counter));}
 raw.prepare('INSERT INTO '+table+'('+names.join(',')+') VALUES ('+names.map(()=>'?').join(',')+')').run(...values);
}
async function populated(){
 const db=database();
 for(const ensure of [ensureFamily,ensureNotifications,ensureArchive,ensureSnooze,ensureHandoffs,ensureGps,ensureBilling,ensureSubscriptions,ensureMail])await ensure(db);
 db.raw.exec('CREATE TABLE IF NOT EXISTS pejlo_subscription_requests(uid TEXT PRIMARY KEY,id TEXT NOT NULL,email TEXT NOT NULL,kind TEXT NOT NULL,created_at INTEGER NOT NULL,handled_at INTEGER)');
 for(const [table,[column]] of Object.entries(owners))for(const uid of ['gone','stays'])insert(db.raw,table,column,uid,table==='pejlo_billing'?{customer_id:'cus_'+uid}:{});
 return db;
}
const count=(db,table,column,uid)=>db.raw.prepare('SELECT COUNT(*) n FROM '+table+' WHERE '+column+'=?').get(uid).n;

test('deleting an account removes its rows in every table and leaves other accounts untouched',async()=>{
 const db=await populated();
 const result=await deleteUserData(db,'gone','gone@example.com');
 assert.ok(result.rows>=Object.keys(owners).length);
 for(const [table,[column]] of Object.entries(owners)){assert.equal(count(db,table,column,'gone'),0,table);assert.equal(count(db,table,column,'stays'),1,table+' of the other account');}
});
test('handoffs on trackers the account owned, and invitations addressed to its e-mail, go too',async()=>{
 const db=await populated();
 insert(db.raw,'pejlo_handoffs','actor_uid','someone-else',{owner_uid:'gone'});
 insert(db.raw,'pejlo_invites','owner_uid','another-owner',{email:'Gone@Example.com'});
 insert(db.raw,'pejlo_invites','owner_uid','another-owner',{email:'other@example.com'});
 await deleteUserData(db,'gone','gone@example.com');
 assert.equal(count(db,'pejlo_handoffs','owner_uid','gone'),0);
 assert.deepEqual(db.raw.prepare('SELECT email FROM pejlo_invites WHERE owner_uid=?').all('another-owner').map(r=>r.email),['other@example.com']);
});
test('tables that do not exist yet are skipped; any other database error stops the deletion',async()=>{
 assert.deepEqual(await deleteUserData(database(),'gone','gone@example.com'),{rows:0});
 const broken={prepare(){return {bind(){return this;},async run(){throw new Error('D1_ERROR: database is locked');}};}};
 await assert.rejects(()=>deleteUserData(broken,'gone','x@example.com'),e=>e.status===502&&/Login er ikke slettet/.test(e.message));
});
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const secret=JSON.stringify({project_id:firebaseConfig.projectId,client_email:'service@example.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
test('the Firestore profile document is deleted with the service account, and failure is reported separately',async()=>{
 const seen=[];
 const ok=async(url,options)=>{const target=new URL(url);if(target.hostname==='oauth2.googleapis.com')return Response.json({access_token:'t'});seen.push({url:target.pathname,method:options.method,auth:options.headers.Authorization});return Response.json({});};
 assert.equal(await deleteFirestoreState(secret,ok,firebaseConfig.projectId,'user/../x'),'deleted');
 assert.deepEqual(seen,[{url:'/v1/projects/'+firebaseConfig.projectId+'/databases/(default)/documents/users/user%2F..%2Fx/private/state',method:'DELETE',auth:'Bearer t'}]);
 const denied=async url=>new URL(url).hostname==='oauth2.googleapis.com'?Response.json({access_token:'t'}):Response.json({error:{status:'PERMISSION_DENIED'}},{status:403});
 assert.equal(await deleteFirestoreState(secret,denied,firebaseConfig.projectId,'u1'),'failed');
 assert.equal(await deleteFirestoreState(secret,async()=>{throw new Error('offline');},firebaseConfig.projectId,'u1'),'failed');
 assert.equal(await deleteFirestoreState('not json',ok,firebaseConfig.projectId,'u1'),'failed');
});
