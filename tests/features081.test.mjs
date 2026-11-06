import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {handleAPI} from '../apps/api/worker.js';
import {ensureFamily} from '../apps/api/family.js';
import {ensureNotifications,runNotifications} from '../apps/api/notifications.js';
import {setSnooze,snoozeUntil} from '../apps/api/snooze.js';
import {pairingLink,parsePairing} from '../apps/web/src/features/pairing.js';
function database(){const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,name TEXT,owner_uid TEXT,code_hash TEXT,claimed_at TEXT)');return {raw,prepare(sql){const stmt=raw.prepare(sql);let args=[];return{bind(...v){args=v;return this;},async run(){stmt.run(...args);},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};}};}};}
async function setup(){const db=database();await ensureFamily(db);await ensureNotifications(db);db.raw.exec("INSERT INTO trackers VALUES('1234','Loui','owner','secret-pairing-hash',null)");db.raw.prepare('INSERT INTO pejlo_profiles VALUES(?,?,?,1)').run('1234','owner',JSON.stringify({name:'Loui'}));db.raw.exec("INSERT INTO pejlo_members(identifier,uid,email,role) VALUES('1234','member','member@example.com','viewer')");return db;}
const req=(path,input)=>new Request('https://pejlo.example/api/'+path,{method:input?'POST':'GET',headers:{Authorization:'Bearer fake',...(input?{'Content-Type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})});
const auth=uid=>async()=>Response.json({users:[{localId:uid,emailVerified:true}]});
test('pause duration is server-controlled, personal, expires and can be resumed',async()=>{
 const db=await setup(),now=Date.now();assert.equal(await setSnooze(db,'1234','owner',1,now),now+3600000);assert.equal(await snoozeUntil(db,'1234','member'),0);
 for(const hours of [2,-1,24,'1',null])await assert.rejects(()=>setSnooze(db,'1234','owner',hours,now),e=>e.status===400);
 assert.equal(await setSnooze(db,'1234','owner',0,now),0);
 await setSnooze(db,'1234','owner',4,now-5*3600000);assert.ok(await snoozeUntil(db,'1234','owner')<now);
});
test('pause API permits viewers own preferences and denies unrelated users',async()=>{
 const DB=await setup(),env={DB};let r=await handleAPI(req('snooze',{identifier:'1234',hours:12}),env,auth('member'));assert.equal(r.status,200);assert.ok((await r.json()).until>Date.now()+11*3600000);
 assert.equal(await snoozeUntil(DB,'1234','owner'),0);
 for(const path of ['snooze?identifier=1234','snooze']){const r=await handleAPI(req(path,path==='snooze'?{identifier:'1234',hours:0}:null),env,auth('stranger'));assert.equal(r.status,403);}
 assert.equal((await handleAPI(req('snooze',{identifier:'1234',hours:999}),env,auth('owner'))).status,400);
});
test('paused events stay archived, other members are unaffected, and paused queued events are dropped',async()=>{
 const DB=await setup(),now=Date.now(),home={lat:56,lon:8,radius:100,buffer:5,shape:'circle'};DB.raw.prepare('INSERT INTO pejlo_fences(identifier,owner_uid,name,config,enabled) VALUES(?,?,?,?,1)').run('1234','owner','Hjem',JSON.stringify(home));
 await setSnooze(DB,'1234','owner',1);const env={DB,TRACCAR_TOKEN:'server-secret'};let i=0;
 const upstream=async url=>Response.json(url.includes('/devices')?[{id:1,uniqueId:'1234',positionId:2}]:[{id:2,deviceId:1,valid:true,latitude:i?56.002:56,longitude:8,fixTime:new Date(now-5000+i*1000).toISOString()}]);
 for(i=0;i<3;i++)await runNotifications(env,upstream);
 const events=DB.raw.prepare("SELECT uid,push_status FROM pejlo_alarm_history WHERE kind='exit' ORDER BY uid").all();assert.equal(events.length,2);assert.equal(events.find(e=>e.uid==='owner').push_status,'snoozed');assert.equal(events.find(e=>e.uid==='member').push_status,'unconfigured');
 const run=DB.raw.prepare('SELECT * FROM pejlo_runs ORDER BY started_at DESC LIMIT 1').get();assert.equal(run.status,'completed');assert.equal(run.checked,1);assert.equal(run.upstream_requests,2);
 DB.raw.prepare('INSERT INTO pejlo_events(id,identifier,uid,kind,payload,created_at) VALUES(?,?,?,?,?,?)').run('queued','1234','owner','exit','{}',now);
 DB.raw.prepare('INSERT INTO pejlo_alarm_history VALUES(?,?,?,?,?,?,?,?,?)').run('queued','1234','owner','exit','{}',now,null,null,'pending');
 await runNotifications({...env,VAPID_PUBLIC_KEY:'x',VAPID_PRIVATE_KEY:'x',VAPID_SUBJECT:'mailto:x@example.com'},upstream);
 assert.equal(DB.raw.prepare("SELECT push_status FROM pejlo_alarm_history WHERE id='queued'").get().push_status,'snoozed');assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM pejlo_events').get().n,0);
});
test('administrator status is protected, records upstream errors and contains no raw credentials',async()=>{
 const DB=await setup(),env={DB,TRACCAR_TOKEN:'DO-NOT-EXPOSE',TRACCAR_ADMIN_UID:'admin'};DB.raw.prepare('INSERT INTO pejlo_alerts(identifier,uid,config) VALUES(?,?,?)').run('1234','owner','{}');DB.raw.prepare('INSERT INTO pejlo_push VALUES(?,?,?)').run('https://secret.endpoint','owner','private-subscription-key');
 await runNotifications(env,async()=>new Response('sensitive upstream error',{status:503}));
 assert.equal((await handleAPI(req('admin/status'),env,auth('owner'))).status,403);
 const r=await handleAPI(req('admin/status'),env,auth('admin'));assert.equal(r.status,200);const value=await r.json();assert.equal(value.runs[0].status,'partial');assert.equal(value.runs[0].upstream_errors,1);assert.equal(value.counts.trackers,1);assert.equal(value.pushUsers[0].devices,1);
 const text=JSON.stringify(value);for(const secret of ['DO-NOT-EXPOSE','secret.endpoint','private-subscription-key','secret-pairing-hash','sensitive upstream error'])assert.equal(text.includes(secret),false);
 for(let i=0;i<22;i++)await runNotifications({DB},async()=>{throw Error('must not fetch');});assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM pejlo_runs').get().n,20);
});
test('pairing links put codes only in fragments and reject foreign origins or malformed values',()=>{
 const origin='https://pejlo.example',code='ABCD0123456789ABCDEF0123456789ABCD',link=pairingLink('080608317309',code,origin),url=new URL(link);assert.equal(url.search,'');assert.equal(url.pathname,'/');assert.deepEqual(parsePairing(link,origin),{identifier:'080608317309',code});
 assert.deepEqual(parsePairing(url.hash,origin),{identifier:'080608317309',code});
 for(const value of [link.replace(origin,'https://evil.example'),'javascript:alert(1)','#parring=1234&kode=short','#parring=<script>&kode='+code])assert.equal(parsePairing(value,origin),null);
});
function worker(maxActions=2){const listeners={},shown=[],opened=[],messages=[];const context={URL,encodeURIComponent,Notification:{maxActions},self:{location:{origin:'https://pejlo.example'},addEventListener:(name,fn)=>listeners[name]=fn,registration:{showNotification:async(t,v)=>shown.push(v)}},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};vm.runInNewContext(readFileSync('apps/web/sw.js','utf8'),context);return {listeners,shown,opened,messages,context};}
test('notification actions fall back gracefully, route to the right profile and never mutate in the service worker',async()=>{
 const w=worker();let pending;w.listeners.push({data:{json:()=>({tracker:'1234',body:'Loui'})},waitUntil:p=>pending=p});await pending;assert.equal(w.shown[0].actions.length,2);
 w.listeners.notificationclick({notification:{close(){},data:{tracker:'1234'}},action:'pause',waitUntil:p=>pending=p});await pending;assert.equal(w.opened[0],'/?profil=1234&handling=pause#indstillinger');
 const fallback=worker(0);fallback.listeners.push({data:{json:()=>({tracker:'1234'})},waitUntil:p=>pending=p});await pending;assert.equal(fallback.shown[0].actions.length,0);
 w.context.clients.matchAll=async()=>[{url:'https://pejlo.example/',focus:async()=>{},postMessage:v=>w.messages.push(v)}];w.listeners.notificationclick({notification:{close(){},data:{tracker:'1234'}},action:'map',waitUntil:p=>pending=p});await pending;assert.equal(w.messages[0].tracker,'1234');assert.equal(w.messages[0].action,'map');assert.equal(w.opened.length,1);
});

test('late pause responses cannot cross profiles, overwrite a pause or survive logout',async()=>{
 const {createSnooze}=await import('../apps/web/src/features/snooze.js');
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{disabled:false,hidden:true,textContent:'',dataset:{}});return elements.get(id);};
 const buttons=[0,1,4,12].map(hours=>({...element('button'+hours),dataset:{snooze:String(hours)}}));
 globalThis.document={querySelector:element,querySelectorAll:()=>buttons};let current={trackerId:'1234',name:'Loui'},pendingGet=null,pendingPost=null;
 const request=async(path,body)=>body?new Promise(r=>pendingPost=r):pendingGet?new Promise(r=>pendingGet=r):{until:0,serverTime:Date.now()};
 const view=createSnooze({request,selected:()=>current});await view.load();
 // Start a refresh, then pause. An old GET result must not undo the POST.
 pendingGet=()=>{};const loading=view.load(true);buttons[1].onclick();await new Promise(r=>setImmediate(r));pendingPost({until:Date.now()+3600000,serverTime:Date.now()});await new Promise(r=>setImmediate(r));pendingGet({until:0,serverTime:Date.now()});await loading;assert.equal(view.paused(),true);
 // A POST returning after a profile change cannot put the next profile on pause.
 pendingGet=null;buttons[2].onclick();await new Promise(r=>setImmediate(r));const oldPost=pendingPost;current={trackerId:'5678',name:'Cykel'};await view.load();assert.equal(buttons[1].disabled,false);oldPost({until:Date.now()+4*3600000,serverTime:Date.now()});await new Promise(r=>setImmediate(r));assert.equal(view.paused(),false);
 pendingGet=()=>{};const logout=view.load(true);view.clear();current=null;pendingGet({until:Date.now()+3600000,serverTime:Date.now()});await logout;assert.equal(view.paused(),false);assert.match(element('#snooze-status').textContent,/Vælg en profil/);
 delete globalThis.document;
});
