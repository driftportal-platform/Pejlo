import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureFamily} from '../apps/api/family.js';
import {ensureNotifications,notificationPayload,runNotifications} from '../apps/api/notifications.js';
import {reserveInvitationMail,sendInvitationMail,appURL} from '../apps/api/mail.js';
import {once} from '../apps/api/schema.js';

function database(){
 const raw=new DatabaseSync(':memory:');let prepared=0;const inserted=[];
 raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,name TEXT,owner_uid TEXT,code_hash TEXT,claimed_at TEXT)');
 return {raw,inserted,count:()=>prepared,prepare(q){prepared++;const stmt=raw.prepare(q);let args=[];return {bind(...v){args=v;return this;},async run(){if(q.includes('INTO pejlo_events'))inserted.push(args);stmt.run(...args);return {success:true};},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};}};}};
}

test('notification texts name the profile and use one tag per tracker',()=>{
 const exit=notificationPayload('exit','1234',{name:'Loui',area:'hjemmeområdet'});
 assert.match(exit.body,/^Loui har forladt hjemmeområdet\./);assert.equal(exit.tag,'pejlo-exit-1234');assert.equal(exit.tracker,'1234');
 assert.match(notificationPayload('enter','1234',{name:'Loui',area:'«Dagpleje»'}).body,/^Loui er tilbage i «Dagpleje»\./);
 assert.match(notificationPayload('battery','1234',{name:'Cyklen',battery:17.2}).body,/^Batteriet på Cyklen er lavt \(17 %\)\./);
 assert.match(notificationPayload('battery','1234',{name:'Cyklen'}).body,/^Batteriet på Cyklen er lavt\./);
 assert.match(notificationPayload('missing','1234',{name:'Bilen'}).body,/^Der mangler nye GPS-positioner fra Bilen\./);
 assert.notEqual(notificationPayload('exit','1234',{name:'A',area:'x'}).tag,notificationPayload('exit','5678',{name:'B',area:'x'}).tag);
 assert.match(notificationPayload('exit','1234',{name:'  ',area:'x'}).body,/^En tracker har forladt/);
 assert.ok(!/[<>\n]/.test(notificationPayload('exit','1234',{name:'<b>X</b>\nY',area:'x'}).body.replace(/ Åbn Pejlo.*/,'')));
});

test('queued event carries the shared profile name and tracker id',async()=>{
 const db=database();await ensureFamily(db);await ensureNotifications(db);
 await db.prepare('INSERT INTO trackers(identifier,name,owner_uid) VALUES(?,?,?)').bind('1234','Tracker 1','owner').run();
 await db.prepare('INSERT INTO pejlo_profiles(identifier,owner_uid,profile,revision) VALUES(?,?,?,1)').bind('1234','owner',JSON.stringify({name:'Loui'})).run();
 const home={shape:'circle',lat:56,lon:8,radius:100,buffer:5};
 await db.prepare('INSERT INTO pejlo_fences(identifier,owner_uid,name,config,enabled) VALUES(?,?,?,?,1)').bind('1234','owner','Hjem',JSON.stringify(home)).run();
 await db.prepare('INSERT INTO pejlo_alerts(identifier,uid,config) VALUES(?,?,?)').bind('1234','owner',JSON.stringify({exit:true,enter:true,lowBattery:false,missing:false,quiet:false})).run();
 let stamp=Date.now()-90000,lat=56;
 const env={DB:db,TRACCAR_TOKEN:'t',VAPID_PUBLIC_KEY:'a',VAPID_PRIVATE_KEY:'b',VAPID_SUBJECT:'mailto:t@example.com'};
 const get=async url=>Response.json(url.includes('/devices')?[{id:7,uniqueId:'1234',positionId:9}]:[{id:9,deviceId:7,valid:true,latitude:lat,longitude:8,fixTime:new Date(stamp).toISOString()}]);
 await runNotifications(env,get);
 stamp+=5000;await runNotifications(env,get);
 lat=56.002;for(let i=0;i<2;i++){stamp+=20000;await runNotifications(env,async url=>{const r=await get(url);return r;});}
 assert.equal(db.inserted.length,1);
 const p=JSON.parse(db.inserted[0][4]);assert.equal(db.inserted[0][3],'exit');
 assert.match(p.body,/^Loui har forladt «Hjem»\./);assert.equal(p.tracker,'1234');assert.equal(p.tag,'pejlo-exit-1234');
});

test('schema steps run once per database',async()=>{
 const db=database();let runs=0;
 await Promise.all([once(db,'x',async()=>{runs++;}),once(db,'x',async()=>{runs++;})]);await once(db,'x',async()=>{runs++;});
 assert.equal(runs,1);
 await assert.rejects(()=>once(db,'bad',async()=>{throw Error('no');}));await once(db,'bad',async()=>{runs++;});assert.equal(runs,2);
 await ensureFamily(db);const after=db.count();await ensureFamily(db);await ensureFamily(db);assert.equal(db.count(),after);
});

test('invitation limits: per sender per day, per recipient per day, hashed log',async()=>{
 const db=database();const t0=1_000_000_000_000;
 for(let i=0;i<10;i++)await reserveInvitationMail(db,'owner',t0+i*61000,'p'+i+'@example.com');
 await assert.rejects(()=>reserveInvitationMail(db,'owner',t0+11*61000,'new@example.com'),e=>e.status===429);
 await reserveInvitationMail(db,'owner',t0+86400000+700000,'new@example.com'); // oldest entries have aged out
 for(let i=0;i<3;i++)await reserveInvitationMail(db,'sender'+i,t0+i,'same@example.com');
 await assert.rejects(()=>reserveInvitationMail(db,'another',t0+5,'SAME@example.com'),e=>e.status===429);
 const rows=db.raw.prepare('SELECT recipient FROM pejlo_mail_log').all();assert.ok(rows.length>0&&rows.every(r=>!r.recipient.includes('@')&&r.recipient.length===64));
});

test('invitation mail names the sender, strips control characters and honours APP_URL',async()=>{
 const env={RESEND_API_KEY:'k',MAIL_FROM:'pejlo@example.com',APP_URL:'https://pejlo.example.dk'};let body;
 await sendInvitationMail({email:'a@example.com',code:'b'.repeat(32),name:'Loui',inviter:'Stefan\r\nBcc: x@y.dk <b>'},env,async(u,o)=>{body=JSON.parse(o.body);return Response.json({id:'1'});});
 assert.match(body.text,/^Stefan Bcc: x@y\.dk b har inviteret dig til profilen Loui i Pejlo\./);
 assert.match(body.text,/https:\/\/pejlo\.example\.dk\/#invitation=b{32}/);
 assert.equal(body.subject,'Du er inviteret til en delt profil i Pejlo');
 assert.equal(appURL({APP_URL:'http://evil.example'}),'https://pejlo.driftportal-platform.workers.dev');
 assert.equal(appURL({APP_URL:'https://x.dk/path'}),'https://pejlo.driftportal-platform.workers.dev');
});

test('a queued GPS alert retries only the failed device and prevents overlapping sends',async()=>{
 const db=database();
 const now=Date.now();
 db.raw.exec('CREATE TABLE pejlo_events(id TEXT PRIMARY KEY,identifier TEXT,uid TEXT,kind TEXT,payload TEXT,created_at INTEGER,attempts INTEGER DEFAULT 0)');
 db.raw.prepare('INSERT INTO pejlo_events(id,identifier,uid,kind,payload,created_at) VALUES(?,?,?,?,?,?)')
  .run('gps-alert','1234','owner','missing',JSON.stringify(notificationPayload('missing','1234',{name:'Loui'})),now);
 await ensureNotifications(db);
 db.raw.prepare('INSERT INTO trackers(identifier,name,owner_uid) VALUES(?,?,?)').run('1234','Loui','owner');
 db.raw.prepare('INSERT INTO pejlo_alerts(identifier,uid,config) VALUES(?,?,?)').run('1234','owner','{"missing":true}');
 const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const receiver=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const publicKey=async key=>Buffer.from(await crypto.subtle.exportKey('raw',key)).toString('base64url');
 const env={
  DB:db,TRACCAR_TOKEN:'test',VAPID_PUBLIC_KEY:await publicKey(vapid.publicKey),
  VAPID_PRIVATE_KEY:(await crypto.subtle.exportKey('jwk',vapid.privateKey)).d,VAPID_SUBJECT:'mailto:test@example.com'
 };
 const phone='https://web.push.apple.com/Q/phone',other='https://web.push.apple.com/Q/other';
 const keys={p256dh:await publicKey(receiver.publicKey),auth:Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')};
 for(const endpoint of [phone,other]){
  db.raw.prepare('INSERT INTO pejlo_push VALUES(?,?,?)').run(endpoint,'owner',JSON.stringify({endpoint,keys}));
 }
 let notifyStarted,releaseFirst;
 const started=new Promise(resolve=>{notifyStarted=resolve;});
 const release=new Promise(resolve=>{releaseFirst=resolve;});
 const sent=[];
 let otherAttempts=0;
 const fetcher=async url=>{
  if(url.startsWith('https://demo3.traccar.org/'))return Response.json([]);
  sent.push(url);
  if(url===phone&&sent.length===1){notifyStarted();await release;}
  const status=url===other&&++otherAttempts<3?503:201;
  return new Response(null,{status});
 };
 const first=runNotifications(env,fetcher);
 await started;
 try{await runNotifications(env,fetcher);assert.deepEqual(sent,[phone]);}
 finally{releaseFirst();await first;}
 assert.deepEqual(sent,[phone,other]);
 const queued=db.raw.prepare('SELECT accepted_endpoints,attempts FROM pejlo_events WHERE id=?').get('gps-alert');
 assert.deepEqual(JSON.parse(queued.accepted_endpoints),[phone]);
 assert.equal(queued.attempts,1);
 await runNotifications(env,fetcher);
 await runNotifications(env,fetcher);
 assert.deepEqual(sent,[phone,other,other,other]);
 assert.equal(db.raw.prepare('SELECT id FROM pejlo_events WHERE id=?').get('gps-alert'),undefined);
});
