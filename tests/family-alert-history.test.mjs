import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureFamily,familyAPI,trackerAccess} from '../apps/api/family.js';
import {ensureNotifications,runNotifications} from '../apps/api/notifications.js';
import {codeHash,handleAPI} from '../apps/api/worker.js';
import {cleanAlerts,advanceAlerts,isQuiet} from '../packages/shared/alerts.js';
import {historyRange,danishDate,routeAnalysis} from '../packages/shared/history.js';
function database(){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,name TEXT,owner_uid TEXT,code_hash TEXT,claimed_at TEXT)');
 const db={prepare(sql){const stmt=raw.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async run(){stmt.run(...args);return {success:true};},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};}};},async batch(statements){raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.all());raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e;}}};return db;
}
const owner={localId:'owner',email:'owner@example.com'},member={localId:'member',email:'member@example.com'},stranger={localId:'stranger',email:'stranger@example.com'};
const profile={id:'loui',name:'Loui',type:'cat',trackerId:'1234',home:{lat:56,lon:8,radius:100,shape:'circle',buffer:5},homeConfirmed:true,geofenceEnabled:true,fencePresets:[{id:'home',name:'Hjem',home:{lat:56,lon:8,radius:100,shape:'circle',buffer:5}}],activeFenceId:'home',deviceLabel:''};
async function setup(){const db=database();await ensureFamily(db);await ensureNotifications(db);await db.prepare('INSERT INTO trackers(identifier,name,owner_uid) VALUES(?,?,?)').bind('1234','Loui','owner').run();return db;}
const call=(db,account,input)=>familyAPI(db,account,input,codeHash);
test('invitation is email-bound, expires, is one-use, grants shared edit and revoke denies access',async()=>{
 const db=await setup();await call(db,owner,{action:'save',identifier:'1234',profile,revision:0});
 const {code}=await call(db,owner,{action:'invite',identifier:'1234',email:member.email});
 await assert.rejects(()=>call(db,stranger,{action:'join',code}),e=>e.status===400);
 await call(db,member,{action:'join',code});await assert.rejects(()=>call(db,member,{action:'join',code}),e=>e.status===400);
 assert.equal((await trackerAccess(db,'1234','member')).owner,false);
 let shared=await call(db,member,null);assert.equal(shared.profiles[0].profile.name,'Loui');assert.equal(shared.profiles[0].owner,false);
 await assert.rejects(()=>call(db,member,{action:'invite',identifier:'1234',email:stranger.email}),e=>e.status===403);
 await call(db,member,{action:'save',identifier:'1234',profile:{...profile,name:'Loui fælles'},revision:1});
 assert.equal((await call(db,owner,null)).profiles[0].profile.name,'Loui fælles');
 await call(db,owner,{action:'revoke',identifier:'1234',uid:member.localId,email:member.email});
 assert.equal(await trackerAccess(db,'1234','member'),null);assert.deepEqual((await call(db,member,null)).profiles,[]);
 await assert.rejects(()=>call(db,member,{action:'save',identifier:'1234',profile,revision:2}),e=>e.status===403);
 const invitation=await call(db,owner,{action:'invite',identifier:'1234',email:member.email});await db.prepare('UPDATE pejlo_invites SET expires=0').run();await assert.rejects(()=>call(db,member,{action:'join',code:invitation.code}),e=>e.status===400);
});
test('optimistic shared revision also protects the monitored fence atomically',async()=>{
 const db=await setup();await call(db,owner,{action:'save',identifier:'1234',profile,revision:0});
 await call(db,owner,{action:'save',identifier:'1234',profile:{...profile,home:{...profile.home,radius:200}},revision:1});
 await assert.rejects(()=>call(db,owner,{action:'save',identifier:'1234',profile:{...profile,home:{...profile.home,radius:900}},revision:1}),e=>e.status===409);
 const row=await db.prepare('SELECT config FROM pejlo_fences').first();assert.equal(JSON.parse(row.config).radius,200);
 await call(db,owner,{action:'delete',identifier:'1234'});assert.equal((await db.prepare('SELECT enabled FROM pejlo_fences').first()).enabled,0);
});
test('Danish day ranges handle winter, summer and both DST transitions',()=>{
 const now=Date.parse('2026-11-05T20:00Z');
 let r=historyRange('2026-11-04','2026-11-04',now);assert.equal(new Date(r.from).toISOString(),'2026-11-03T23:00:00.000Z');assert.equal(r.to-r.from,86400000);
 r=historyRange('2026-07-01','2026-07-01',now);assert.equal(new Date(r.from).toISOString(),'2026-06-30T22:00:00.000Z');
 assert.equal(historyRange('2026-03-29','2026-03-29',now).to-historyRange('2026-03-29','2026-03-29',now).from,23*3600000);
 assert.equal(historyRange('2026-10-25','2026-10-25',now).to-historyRange('2026-10-25','2026-10-25',now).from,25*3600000);
 assert.equal(danishDate(Date.parse('2026-11-04T23:30Z')),'2026-11-05');
 for(const dates of [['2026-02-30','2026-02-30'],['2026-01-01','2026-03-01'],['2026-11-06','2026-11-06'],['2026-11-05','2026-11-04']])assert.throws(()=>historyRange(...dates,now));
});
test('route analysis splits gaps, excludes impossible jumps and does not count small drift',()=>{
 const p=(lat,t)=>({lat,lon:8,timestamp:t});const a=routeAnalysis([p(56,1),p(56.00001,1001),p(57,2001),p(56.0002,20001),p(56.001,700001)]);
 assert.equal(a.rejected,1);assert.equal(a.segments.length,2);assert.equal(a.gaps.length,1);assert.ok(a.meters>10&&a.meters<30);
});
test('alarm thresholds deduplicate, recover and use Danish quiet hours including midnight',()=>{
 const now=Date.parse('2026-11-05T12:00Z'),config=cleanAlerts({lowBattery:true,missing:true,batteryThreshold:20,missingMinutes:10});
 const raw=(t,battery=19)=>({valid:true,latitude:56,longitude:8,fixTime:new Date(t).toISOString(),attributes:{batteryLevel:battery}});
 let r=advanceAlerts(config,raw(now),{},now);assert.deepEqual(r.events,['battery']);
 r=advanceAlerts(config,raw(now+1000),r.state,now+1000);assert.deepEqual(r.events,[]);
 r=advanceAlerts(config,null,r.state,now+601001);assert.deepEqual(r.events,['missing']);r=advanceAlerts(config,null,r.state,now+660000);assert.deepEqual(r.events,[]);
 r=advanceAlerts(config,raw(now+660000,30),r.state,now+660000);assert.equal(r.state.missing,false);r=advanceAlerts(config,raw(now+661000),r.state,now+661000);assert.deepEqual(r.events,['battery']);
 assert.equal(isQuiet({...config,quiet:true},Date.parse('2026-11-05T21:00Z')),true);assert.equal(isQuiet({...config,quiet:true},Date.parse('2026-11-06T05:59Z')),true);assert.equal(isQuiet({...config,quiet:true},Date.parse('2026-11-06T06:00Z')),false);
 assert.deepEqual(advanceAlerts(config,{...raw(now),valid:false},{},now).events,[]);
});
test('shared and revoked users are enforced by actual tracker API; chosen history date reaches Traccar',async()=>{
 const db=await setup();await call(db,owner,{action:'save',identifier:'1234',profile,revision:0});const {code}=await call(db,owner,{action:'invite',identifier:'1234',email:member.email});await call(db,member,{action:'join',code});
 let report;
 const fetcher=async(url)=>{if(url.includes('accounts:lookup'))return Response.json({users:[{...member,emailVerified:true}]});if(url.includes('/devices'))return Response.json([{id:1,uniqueId:'1234',positionId:2}]);if(url.includes('/positions'))return Response.json([]);report=new URL(url);return Response.json([]);};
 const request=()=>new Request('https://pejlo.example/api/tracker?identifier=1234&from=2026-11-04&to=2026-11-04',{headers:{Authorization:'Bearer test'}});
 assert.equal((await handleAPI(request(),{DB:db,TRACCAR_TOKEN:'token'},fetcher)).status,200);assert.equal(report.searchParams.get('from'),'2026-11-03T23:00:00.000Z');
 await call(db,owner,{action:'revoke',identifier:'1234',uid:'member',email:member.email});assert.equal((await handleAPI(request(),{DB:db,TRACCAR_TOKEN:'token'},fetcher)).status,403);
});
test('cron queues independent low battery and missing GPS alerts even with geofence disabled',async()=>{
 const db=await setup();let now=Date.now();const config=cleanAlerts({lowBattery:true,missing:true,missingMinutes:5});await db.prepare('INSERT INTO pejlo_alerts(identifier,uid,config,state) VALUES(?,?,?,?)').bind('1234','owner',JSON.stringify(config),'{}').run();
 const env={DB:db,TRACCAR_TOKEN:'token',VAPID_PUBLIC_KEY:'fake',VAPID_PRIVATE_KEY:'fake',VAPID_SUBJECT:'mailto:x@example.com'};
 let stamp=now,battery=10;const get=async url=>Response.json(url.includes('/devices')?[{id:1,uniqueId:'1234',positionId:2}]:[{id:2,deviceId:1,valid:true,latitude:56,longitude:8,fixTime:new Date(stamp).toISOString(),attributes:{batteryLevel:battery}}]);
 await runNotifications(env,get);let state=JSON.parse((await db.prepare('SELECT state FROM pejlo_alerts').first()).state);assert.equal(state.low,true);
 stamp=now-600000;await db.prepare('UPDATE pejlo_alerts SET state=?').bind(JSON.stringify({lastFix:stamp,started:stamp})).run();await runNotifications(env,get);state=JSON.parse((await db.prepare('SELECT state FROM pejlo_alerts').first()).state);assert.equal(state.missing,true);
});
