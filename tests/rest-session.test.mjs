import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureFamily} from '../apps/api/family.js';
import {restSessionAPI,observeRestSession,runRestSessions} from '../apps/api/rest-session.js';
import {automaticRest} from '../apps/api/rest-store.js';
import {mergeActivity} from '../packages/shared/activity.js';
import {restMovement} from '../packages/shared/rest-session.js';
import {deleteUserData} from '../apps/api/user-data.js';
import {createRestSession} from '../dist/src/features/rest-session.js';
const start=Date.parse('2026-11-25T12:00:00Z'),identifier='080608317309',source='a',day='2026-11-25';
const fix=(min,lat=56.5+min*.0003,extra={})=>({timestamp:start+min*60000,lat,lon:8.3,valid:true,speedKph:4,charging:false,satellites:15,accuracy:null,...extra});
async function fixture(){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT)');
 const db={prepare(sql){const s=raw.prepare(sql);let a=[];return {bind(...v){a=v;return this;},async first(){return s.get(...a)||null;},async run(){return s.run(...a);},async all(){return {results:s.all(...a)};}};}};
 await ensureFamily(db);raw.prepare('INSERT INTO trackers VALUES(?,?)').run(identifier,'owner');
 const profile={id:'loui',name:'Loui',type:'cat',trackerId:identifier,attachment:{state:'worn',since:start-60000,trackerId:identifier}};
 raw.prepare('INSERT INTO pejlo_profiles VALUES(?,?,?,1)').run(identifier,'owner',JSON.stringify(profile));
 for(const role of ['viewer','editor'])raw.prepare('INSERT INTO pejlo_members VALUES(?,?,?,?)').run(identifier,role,role+'@test.dk',role);
 const query={identifier,profileId:'loui',type:'cat'},api=(input=null,uid='owner',now=start,other={})=>restSessionAPI({db,uid,query,input:input?{...query,...input}:null,source,now,...other});
 const observe=(samples,now,extra={})=>observeRestSession({db,identifier,owner:'owner',profile,source,samples,now,...extra});
 return {raw,db,profile,api,observe};
}
test('manual rest is idempotent, limited to one active session and writable only by owner/editor',async()=>{
 const f=await fixture(),id=crypto.randomUUID();assert.equal((await f.api()).active,null);
 await assert.rejects(()=>f.api({action:'start',id},'viewer'),{status:403});await assert.rejects(()=>f.api(null,'stranger'),{status:403});
 await f.api({action:'start',id});await f.api({action:'start',id},'owner',start+60000);
 assert.equal((await f.api()).history.length,1);assert.equal((await f.api()).active.startedAt,start);
 await assert.rejects(()=>f.api({action:'start',id:crypto.randomUUID()},'editor'),{status:409});
 const stopped=await f.api({action:'stop',id},'editor',start+600000);assert.equal(stopped.active,null);assert.equal(stopped.history[0].endedAt,start+600000);assert.equal(stopped.history[0].reason,'manual');
 const next=crypto.randomUUID();await f.api({action:'start',id:next},'owner',start+700000);await f.api({action:'stop',id},'owner',start+800000);assert.equal((await f.api()).active.id,next,'late stop must not close a new session');
 assert.equal((await f.api(null,'owner',start,{source:'b'})).history.length,0);
});
test('manual start requires a worn tracker and rejects a recent charging report',async()=>{
 const f=await fixture();f.raw.prepare('UPDATE pejlo_profiles SET profile=?').run(JSON.stringify({...f.profile,attachment:null}));
 await assert.rejects(()=>f.api({action:'start',id:crypto.randomUUID()}),{status:409});
 f.raw.prepare('UPDATE pejlo_profiles SET profile=?').run(JSON.stringify(f.profile));
 await automaticRest(f.db,'owner','profile:loui',f.profile,source,day,day,start);
 f.raw.prepare('INSERT INTO pejlo_rest_reports VALUES(?,?,?,?,?,?,?,?)').run(identifier,source,'owner','loui',start-1000,'position_report',1,null);
 await assert.rejects(()=>f.api({action:'start',id:crypto.randomUUID()}),{status:409});
});
test('auto stop requires three new credible fixes and records the first movement time, not poll time',async()=>{
 const f=await fixture();await f.api({action:'start',id:crypto.randomUUID()});
 await f.observe([fix(1)],start+60000);await f.observe([fix(1)],start+120000);assert.ok((await f.api()).active);
 await f.observe([fix(2)],start+120000);assert.ok((await f.api()).active);
 await f.observe([fix(3)],start+180000);const result=await f.api();assert.equal(result.active,null);assert.equal(result.history[0].endedAt,start+60000);assert.equal(result.history[0].reason,'movement');
 assert.equal(f.raw.prepare('SELECT samples FROM pejlo_rest_sessions').get().samples,'[]');
});
test('four coherent positions can confirm relocation while instantaneous speed reports remain zero',()=>{
 const rows=[1,3,5,7].map(m=>fix(m,56.5+m*.00015,{speedKph:0})),now=start+7*60000;
 assert.equal(restMovement(rows.slice(0,3),start,'cat',now),null);
 const move=restMovement(rows,start,'cat',now);assert.equal(move.fixes,4);assert.equal(move.at,rows[0].timestamp);
 for(const points of [rows.map(p=>({...p,lat:56.5})),[fix(1,56.5,{speedKph:0}),fix(3,56.502,{speedKph:0}),fix(5,56.50201,{speedKph:0}),fix(7,56.50201,{speedKph:0})],rows.map((p,i)=>({...p,satellites:i===2?0:15})),rows.map((p,i)=>({...p,lat:i===3?56.5:p.lat}))])assert.equal(restMovement(points,start,'cat',now),null);
});
test('a single large jump followed by small GPS drift cannot stop rest through the four-fix path',()=>{
 const rows=[fix(1,56.5,{speedKph:0}),fix(3,56.502,{speedKph:0}),fix(5,56.50215,{speedKph:0}),fix(7,56.5023,{speedKph:0})];
 assert.equal(restMovement(rows,start,'cat',start+7*60000),null);
 const drift=[[56.556615,8.329767],[56.556614,8.329768],[56.556611,8.329785],[56.556602,8.329769],[56.556541,8.329666],[56.556530,8.329640],[56.556507,8.329603],[56.556508,8.329623]];
 assert.equal(restMovement(drift.map(([lat,lon],i)=>fix(i+1,lat,{lon,speedKph:0})),start,'cat',start+8*60000),null);
});
test('history recovery closes a still-open session at the original movement time, not when the app reopens',async()=>{
 const f=await fixture();await f.api({action:'start',id:crypto.randomUUID()});
 const rows=[1,3,5,7].map(m=>fix(m,56.5+m*.00015,{speedKph:0})),later=start+3*3600000;
 await f.observe(rows,later);assert.ok((await f.api()).active,'old fixes are not a live measurement');
 await f.observe(rows,later,{historical:true});const state=await f.api();assert.equal(state.active,null);assert.equal(state.history[0].endedAt,rows[0].timestamp);assert.equal(state.history[0].reason,'movement');
 await f.observe(rows,later+60000,{historical:true});assert.equal((await f.api()).history[0].endedAt,rows[0].timestamp);
});
test('server recovery reads saved movement even if latest position is stationary or offline',async()=>{
 const f=await fixture();await f.api({action:'start',id:crypto.randomUUID()});const later=start+3*3600000;
 const rows=[1,3,5,7].map(m=>fix(m,56.5+m*.00015,{speedKph:0})),requests=[];
 const fetcher=async(url,options)=>{requests.push(url);assert.ok(!options.method||options.method==='GET');
  if(url.includes('/api/devices?'))return Response.json([{id:7,uniqueId:identifier,status:'offline'}]);
  assert.ok(url.includes('/api/reports/route?'));
  return Response.json(rows.map(p=>({deviceId:7,fixTime:new Date(p.timestamp).toISOString(),serverTime:new Date(p.timestamp+1000).toISOString(),valid:true,latitude:p.lat,longitude:p.lon,speed:0,attributes:{charge:false,sat:15}})));
 };
 await runRestSessions({DB:f.db,TRACCAR_TOKEN:'test',TRACCAR_SOURCE:source},fetcher,'https://traccar.test',later);
 assert.equal((await f.api()).active,null);assert.equal((await f.api()).history[0].endedAt,rows[0].timestamp);assert.equal(requests.length,2);
});
test('GPS jumps back, poor fixes, old/future fixes, missing speed and gaps never prove movement',()=>{
 const samples=[fix(1),fix(2),fix(3)],now=start+180000;
 assert.ok(restMovement(samples,start,'cat',now));
 for(const rows of [[fix(1),fix(2,57),fix(3)],samples.map(p=>({...p,speedKph:0})),samples.map(p=>({...p,satellites:0})),samples.map(p=>({...p,accuracy:80})),samples.map(p=>({...p,valid:false})),[fix(1),fix(4),fix(7)],[fix(1),fix(1),fix(2)],samples.map(p=>({...p,timestamp:p.timestamp+3600000}))])assert.equal(restMovement(rows,start,'cat',now),null);
 assert.equal(restMovement(samples,start,'cat',now+3600000),null);
});
test('absence of data leaves manual rest open; charging or removing the tracker ends it with a reason',async()=>{
 for(const kind of ['charging','removed']){
  const f=await fixture();await f.api({action:'start',id:crypto.randomUUID()});await f.observe([],start+600000);assert.ok((await f.api()).active);
  await f.observe(kind==='charging'?[fix(11,56.5,{charging:true,valid:false})]:[],start+660000,kind==='removed'?{profile:{...f.profile,attachment:{...f.profile.attachment,state:'removed',since:start+600000}}}:{});
  const r=(await f.api()).history[0];assert.equal(r.reason,kind);assert.ok(r.endedAt>=start);
 }
});
test('registered periods appear in daily overview without doubling GPS rest and preserve manual zero',async()=>{
 const f=await fixture(),id=crypto.randomUUID();await f.api({action:'start',id});await f.api({action:'stop',id},'owner',start+15*60000);
 const now=start+3600000,r=await automaticRest(f.db,'owner','profile:loui',f.profile,source,day,day,now,[[start+5*60000,start+20*60000]]);
 // GPS must also have a historical worn confirmation before it can count.
 f.raw.prepare('INSERT INTO pejlo_rest_wear VALUES(?,?,?,?,?,?)').run(identifier,'owner','loui',1,start-60000,1);
 const both=await automaticRest(f.db,'owner','profile:loui',f.profile,source,day,day,now,[[start+5*60000,start+20*60000]]);
 assert.equal(r.restDays[0].estimatedRestMinutes,15);assert.equal(both.restDays[0].estimatedRestMinutes,20);assert.equal(both.restDays[0].registeredRestMinutes,15);
 const row=mergeActivity([day],[],[],both.restDays)[0];assert.equal(row.restSource,'registered');assert.equal(mergeActivity([day],[{day,rest_hours:0}],[],both.restDays)[0].restHours,0);
 f.raw.prepare('INSERT INTO pejlo_rest_settings VALUES(?,?,0)').run('owner','profile:loui');const off=await automaticRest(f.db,'owner','profile:loui',f.profile,source,day,day,now);assert.equal(off.restDays[0].estimatedRestMinutes,15,'the manual button works independently of automatic estimates');
 await deleteUserData(f.db,'owner');assert.equal(f.raw.prepare('SELECT count(*) n FROM pejlo_rest_sessions').get().n,0);
});
test('registered sessions split across Danish midnight in daily totals',async()=>{
 const f=await fixture(),midnight=Date.parse('2026-11-24T23:00:00Z'),id=crypto.randomUUID();
 // Confirm worn before the test interval, without backdating an actual UI action.
 f.raw.prepare('UPDATE pejlo_profiles SET profile=?').run(JSON.stringify({...f.profile,attachment:{...f.profile.attachment,since:midnight-3600000}}));
 await f.api({action:'start',id},'owner',midnight-600000);await f.api({action:'stop',id},'owner',midnight+600000);
 const r=await automaticRest(f.db,'owner','profile:loui',f.profile,source,'2026-11-24','2026-11-25',start);
 assert.deepEqual(r.restDays.map(d=>d.registeredRestMinutes),[10,10]);
});
test('background checking works with the app closed and only reads the tracker server',async()=>{
 const f=await fixture();await f.api({action:'start',id:crypto.randomUUID()});let at=start;
 const requests=[],fetcher=async(url,options)=>{requests.push(url);assert.ok(!options.method||options.method==='GET');
  if(url.includes('/api/devices?'))return Response.json([{id:7,uniqueId:identifier,status:'online',positionId:1}]);
  const p=fix((at-start)/60000);return Response.json([{id:1,deviceId:7,fixTime:new Date(at).toISOString(),serverTime:new Date(at).toISOString(),valid:true,latitude:p.lat,longitude:p.lon,speed:4/1.852,attributes:{charge:false,sat:15}}]);};
 for(let i=1;i<=3;i++){at=start+i*60000;await runRestSessions({DB:f.db,TRACCAR_TOKEN:'test',TRACCAR_SOURCE:source},fetcher,'https://traccar.test',at);}
 assert.equal((await f.api()).active,null);assert.equal((await f.api()).history[0].reason,'movement');assert.equal(requests.length,7);assert.ok(requests.every(u=>!u.includes('commands')));
});
test('manual rest button starts/stops one period, logs its duration and ignores a late profile response',async()=>{
 const fields=Object.fromEntries(['toggle','status','log'].map(k=>[k,{children:[],attrs:{},setAttribute(k,v){this.attrs[k]=v;},replaceChildren(){this.children=[];},append(p){this.children.push(p);}}]));
 const root={ownerDocument:{createElement(){return {};}},querySelector(s){return fields[s.match(/rest-(\w+)/)[1]];}};
 let profile={type:'cat',id:'loui',name:'Loui',trackerId:identifier,attachment:{state:'worn'}},current={active:null,history:[],canEdit:true};const calls=[];
 const request=async(path,body)=>{calls.push(body);if(body?.action==='start')current={...current,active:{id:body.id,startedAt:Date.now(),endedAt:null},history:[]};if(body?.action==='stop')current={...current,active:null,history:[{id:body.id,startedAt:Date.now()-600000,endedAt:Date.now(),reason:'manual'}]};return current;};
 const ui=createRestSession({root,selected:()=>profile,request,data:()=>null,notice(){}});ui.sync();await new Promise(r=>setImmediate(r));assert.equal(fields.toggle.textContent,'Start hvile');
 fields.toggle.onclick();await new Promise(r=>setImmediate(r));assert.equal(fields.toggle.attrs['aria-pressed'],'true');assert.equal(fields.toggle.textContent,'Stop hvile');
 fields.toggle.onclick();await new Promise(r=>setImmediate(r));assert.equal(fields.toggle.attrs['aria-pressed'],'false');assert.match(fields.log.children[0].textContent,/0 t 10 min.*Stoppet manuelt/);
 profile={id:'car',type:'car'};ui.sync();assert.equal(root.hidden,true);assert.equal(calls.filter(c=>c?.action==='start').length,1);
});
test('a late start response cannot activate the button or expose a log after switching profiles',async()=>{
 const fields=Object.fromEntries(['toggle','status','log'].map(k=>[k,{attrs:{},setAttribute(k,v){this.attrs[k]=v;},replaceChildren(){this.children=[];},append(p){this.children.push(p);}}]));
 const root={ownerDocument:{createElement(){return {};}},querySelector(s){return fields[s.match(/rest-(\w+)/)[1]];}};
 let profile={type:'cat',id:'loui',name:'Loui',trackerId:identifier,attachment:{state:'worn'}},finish;
 const request=async(path,body)=>body?new Promise(r=>finish=r):{active:null,history:[],canEdit:true};
 const ui=createRestSession({root,selected:()=>profile,request,data:()=>null,notice(){}});ui.sync();await new Promise(r=>setImmediate(r));
 fields.toggle.onclick();await new Promise(r=>setImmediate(r));assert.equal(typeof finish,'function');
 profile={type:'car',id:'car'};ui.sync();finish({active:{id:'old',startedAt:Date.now()},history:[{id:'old',startedAt:Date.now(),endedAt:null}],canEdit:true});
 await new Promise(r=>setImmediate(r));assert.equal(root.hidden,true);assert.equal(fields.log.children.length,0);
});
