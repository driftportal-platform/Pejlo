import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureFamily,familyAPI,trackerAccess} from '../apps/api/family.js';
import {ensureNotifications} from '../apps/api/notifications.js';
import {codeHash} from '../apps/api/worker.js';
function database(setup){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,name TEXT,owner_uid TEXT,code_hash TEXT,claimed_at TEXT)');setup?.(raw);
 return {raw,prepare(sql){const stmt=raw.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async run(){stmt.run(...args);return {success:true};},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};}};},async batch(list){raw.exec('BEGIN');try{const out=[];for(const s of list)out.push(await s.all());raw.exec('COMMIT');return out;}catch(e){raw.exec('ROLLBACK');throw e;}}};
}
const owner={localId:'owner',email:'owner@example.com'},editor={localId:'editor',email:'editor@example.com'},viewer={localId:'viewer',email:'viewer@example.com'};
const home={lat:56,lon:8,radius:100,shape:'circle',buffer:5};
const profile={id:'loui',name:'Loui',type:'cat',trackerId:'1234',home,homeConfirmed:true,geofenceEnabled:true,fencePresets:[{id:'home',name:'Hjem',home}],activeFenceId:'home',deviceLabel:''};
const call=(db,account,input)=>familyAPI(db,account,input,codeHash);
async function setup(){const db=database();await ensureFamily(db);await ensureNotifications(db);await db.prepare('INSERT INTO trackers(identifier,name,owner_uid) VALUES(?,?,?)').bind('1234','Loui','owner').run();await call(db,owner,{action:'save',identifier:'1234',profile,revision:0});return db;}
async function share(db,account,role){const invite=await call(db,owner,{action:'invite',identifier:'1234',email:account.email,...(role?{role}:{})});await call(db,account,{action:'join',code:invite.code});return invite;}

test('invitation role is stored, defaults to editor and is validated',async()=>{
 const db=await setup();
 assert.equal((await call(db,owner,{action:'invite',identifier:'1234',email:'a@example.com'})).role,'editor');
 await assert.rejects(()=>call(db,owner,{action:'invite',identifier:'1234',email:'b@example.com',role:'admin'}),e=>e.status===400);
 await share(db,viewer,'viewer');
 assert.deepEqual(await trackerAccess(db,'1234','viewer'),{owner:false,role:'viewer'});
 const mine=(await call(db,viewer,null)).profiles[0];assert.equal(mine.role,'viewer');assert.equal(mine.owner,false);assert.deepEqual(mine.members,[]);
 const listed=(await call(db,owner,null)).profiles[0];assert.equal(listed.role,'owner');assert.equal(listed.members.find(m=>m.uid==='viewer').role,'viewer');
});

test('a viewer sees the profile but can neither save, invite nor change roles',async()=>{
 const db=await setup();await share(db,viewer,'viewer');
 await assert.rejects(()=>call(db,viewer,{action:'save',identifier:'1234',profile:{...profile,name:'Hacket'},revision:1}),e=>e.status===403&&/læseadgang/.test(e.message));
 await assert.rejects(()=>call(db,viewer,{action:'invite',identifier:'1234',email:'x@example.com'}),e=>e.status===403);
 await assert.rejects(()=>call(db,viewer,{action:'setrole',identifier:'1234',uid:'viewer',role:'editor'}),e=>e.status===403);
 await assert.rejects(()=>call(db,viewer,{action:'delete',identifier:'1234'}),e=>e.status===403);
 assert.equal((await call(db,owner,null)).profiles[0].profile.name,'Loui');
 await call(db,viewer,{action:'leave',identifier:'1234'});assert.equal(await trackerAccess(db,'1234','viewer'),null);
});

test('owner can promote and demote; changes apply to the next call',async()=>{
 const db=await setup();await share(db,viewer,'viewer');
 await call(db,owner,{action:'setrole',identifier:'1234',uid:'viewer',role:'editor'});
 await call(db,viewer,{action:'save',identifier:'1234',profile:{...profile,name:'Loui 2'},revision:1});
 await call(db,owner,{action:'setrole',identifier:'1234',uid:'viewer',role:'viewer'});
 await assert.rejects(()=>call(db,viewer,{action:'save',identifier:'1234',profile:{...profile,name:'Loui 3'},revision:2}),e=>e.status===403);
 await assert.rejects(()=>call(db,owner,{action:'setrole',identifier:'1234',uid:'viewer',role:'root'}),e=>e.status===400);
 await assert.rejects(()=>call(db,owner,{action:'setrole',identifier:'1234',uid:'nobody',role:'viewer'}),e=>e.status===404);
});

test('an editor changing or pausing the area queues a notice for the owner; a rename does not',async()=>{
 const db=await setup();await share(db,editor,'editor');
 await call(db,editor,{action:'save',identifier:'1234',profile:{...profile,name:'Loui nyt navn'},revision:1});
 assert.equal(db.raw.prepare("SELECT COUNT(*) n FROM pejlo_events WHERE kind='fencechange'").get().n,0);
 await call(db,editor,{action:'save',identifier:'1234',profile:{...profile,name:'Loui nyt navn',geofenceEnabled:false},revision:2});
 const rows=db.raw.prepare("SELECT uid,payload FROM pejlo_events WHERE kind='fencechange'").all();
 assert.equal(rows.length,1);assert.equal(rows[0].uid,'owner');
 const p=JSON.parse(rows[0].payload);assert.match(p.body,/^editor@example\.com har slået områdeovervågningen fra for Loui nyt navn\./);assert.equal(p.tracker,'1234');
 // the owner's own edits never notify
 await call(db,owner,{action:'save',identifier:'1234',profile:{...profile,name:'Loui nyt navn',geofenceEnabled:true,home:{...home,radius:300}},revision:3});
 assert.equal(db.raw.prepare("SELECT COUNT(*) n FROM pejlo_events WHERE kind='fencechange'").get().n,1);
});

test('tables created before roles existed are upgraded and keep editing rights',async()=>{
 const db=database(raw=>{
  raw.exec('CREATE TABLE pejlo_profiles(identifier TEXT PRIMARY KEY,owner_uid TEXT NOT NULL,profile TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1)');
  raw.exec('CREATE TABLE pejlo_members(identifier TEXT NOT NULL,uid TEXT NOT NULL,email TEXT NOT NULL,PRIMARY KEY(identifier,uid))');
  raw.exec('CREATE TABLE pejlo_invites(hash TEXT PRIMARY KEY,identifier TEXT NOT NULL,owner_uid TEXT NOT NULL,email TEXT NOT NULL,expires INTEGER NOT NULL)');
  raw.exec("INSERT INTO trackers(identifier,name,owner_uid) VALUES('1234','Loui','owner')");
  raw.exec("INSERT INTO pejlo_profiles VALUES('1234','owner','"+JSON.stringify(profile)+"',1)");
  raw.exec("INSERT INTO pejlo_members VALUES('1234','editor','editor@example.com')");
 });
 await ensureFamily(db);await ensureNotifications(db);
 assert.deepEqual(await trackerAccess(db,'1234','editor'),{owner:false,role:'editor'});
 await call(db,editor,{action:'save',identifier:'1234',profile:{...profile,name:'Efter opgradering'},revision:1});
});
