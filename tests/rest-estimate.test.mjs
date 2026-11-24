import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {estimateRest} from '../packages/shared/rest-estimate.js';
import {mergeActivity} from '../packages/shared/activity.js';
import {ensureRest,archiveRestReports,automaticRest} from '../apps/api/rest-store.js';
import {ensureFamily,familyAPI} from '../apps/api/family.js';
import {ensureNotifications} from '../apps/api/notifications.js';
import {activityAPI} from '../apps/api/activity.js';
import {deleteUserData} from '../apps/api/user-data.js';
const day='2026-11-24',start=Date.parse(day+'T12:00:00Z'),now=start+3600000,id='080608317309';
const e=(min,kind,extra={})=>({at:start+min*60000,kind,...extra});
const initial=[e(0,'wear_on'),e(0,'position_report',{charging:false}),e(0,'sleep_report')];
const minutes=events=>estimateRest(events,day,day,now)[0].estimatedRestMinutes;

test('rest needs worn, explicit sleep and recent non-charging evidence; ordinary reports do not prove wakefulness',()=>{
 assert.equal(minutes([...initial,e(5,'heartbeat'),e(10,'position_report',{charging:false}),e(20,'heartbeat')]),15);
 assert.equal(minutes([e(0,'wear_on'),e(0,'position_report',{charging:false}),e(5,'heartbeat')]),0);
 assert.equal(minutes([e(0,'sleep_report'),e(5,'heartbeat')]),0);
 assert.equal(minutes([e(0,'wear_on'),e(0,'sleep_report'),e(5,'heartbeat')]),0);
 assert.equal(minutes(initial),0,'never extrapolate past last report');
});
test('charging, confirmed movement and attachment changes end the estimate',()=>{
 for(const stop of [e(5,'position_report',{charging:true}),e(5,'position_report',{motion:true}),e(5,'wear_off')])assert.equal(minutes([...initial,stop,e(10,'heartbeat')]),5);
 assert.equal(minutes([...initial,e(5,'wear_off'),e(7,'wear_on'),e(10,'heartbeat')]),5,'putting it back on requires a new sleep report');
 assert.equal(minutes([...initial,e(20,'heartbeat')]),0,'a long gap stays unknown');
 assert.equal(minutes([...initial,e(10,'heartbeat'),e(20,'sleep_report'),e(25,'heartbeat')]),15,'stale charging evidence cannot renew sleep');
});
test('rest intervals split at Danish midnight, retain unknown days and obey daylight saving boundaries',()=>{
 for(const date of ['2026-11-24','2026-03-29','2026-10-25']){
  const midnight=Date.parse(date+(date==='2026-03-29'?'T22:00:00Z':'T23:00:00Z')),next=new Date(Date.parse(date)+86400000).toISOString().slice(0,10);
  const events=[{at:midnight-300000,kind:'wear_on'},{at:midnight-300000,kind:'position_report',charging:false},{at:midnight-300000,kind:'sleep_report'},{at:midnight+300000,kind:'heartbeat'}];
  const rows=estimateRest(events,date,next,midnight+600000);assert.deepEqual(rows.map(r=>r.estimatedRestMinutes),[5,5]);
 }
 assert.equal(estimateRest([],day,day,now)[0].estimatedRestHours,null);
});
test('a manual daily total, including zero, replaces estimated rest; clearing it restores the estimate',()=>{
 const rest=[{day,estimatedRestHours:2.5}];
 assert.equal(mergeActivity([day],[{day,rest_hours:0}],[],rest)[0].restHours,0);
 assert.equal(mergeActivity([day],[{day,rest_hours:4}],[],rest)[0].restHours,4);
 const r=mergeActivity([day],[{day,rest_hours:null}],[],rest)[0];assert.equal(r.restHours,2.5);assert.equal(r.restSource,'estimated');
});
async function fixture(){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT)');
 const db={prepare(sql){const s=raw.prepare(sql);let a=[];return {bind(...v){a=v;return this;},async first(){return s.get(...a)||null;},async run(){return s.run(...a);},async all(){return {results:s.all(...a)};}};},async batch(list){raw.exec('BEGIN');try{const out=[];for(const s of list)out.push(await s.all());raw.exec('COMMIT');return out;}catch(e){raw.exec('ROLLBACK');throw e;}}};
 await ensureFamily(db);await ensureNotifications(db);await ensureRest(db);
 raw.prepare('INSERT INTO trackers VALUES(?,?)').run(id,'owner');
 const profile={id:'loui',name:'Loui',type:'cat',trackerId:id,home:{lat:56,lon:8,radius:100,shape:'circle'},attachment:{state:'worn',since:start-60000,trackerId:id}};
 raw.prepare('INSERT INTO pejlo_profiles(identifier,owner_uid,profile) VALUES(?,?,?)').run(id,'owner',JSON.stringify(profile));
 const env={DB:db,TRACCAR_SOURCE:'source'},query={profileId:'loui',identifier:id,type:'cat',from:day,to:day};
 const api=(input=null,uid='owner')=>activityAPI({db,uid,query,input:input?{...query,...input}:null,source:'source',now});
 return {raw,db,profile,env,api};
}
test('archive bootstraps at activation, excludes old backfill and isolates sources and accounts',async()=>{
 const f=await fixture();await archiveRestReports(f.env,id,[{at:start-300000,kind:'position_report',charging:0},{at:start-300000,kind:'sleep_report',charging:null}],start);
 assert.equal((await f.api()).restDays[0].estimatedRestHours,null);
 await archiveRestReports(f.env,id,[{at:start,kind:'position_report',charging:0},{at:start,kind:'sleep_report',charging:null},{at:start+300000,kind:'heartbeat',charging:null}],start+300000);
 assert.equal((await f.api()).restDays[0].estimatedRestMinutes,5);
 await archiveRestReports(f.env,id,[{at:start+300000,kind:'heartbeat',charging:null}],start+300000);
 assert.equal((await f.api()).restDays[0].estimatedRestMinutes,5,'replays never duplicate rest');
 assert.equal((await automaticRest(f.db,'owner','profile:loui',f.profile,'other',day,day,now)).restDays[0].estimatedRestHours,null);
 await assert.rejects(()=>f.api(null,'outsider'),{status:403});
 await f.api({action:'goal',goalKm:null,autoRestEnabled:false,revision:0});assert.deepEqual((await f.api()).restDays,[]);
 await f.api({action:'goal',goalKm:null,autoRestEnabled:true,revision:1});assert.equal((await f.api()).restDays[0].estimatedRestMinutes,5);
 await assert.rejects(()=>f.api({action:'goal',goalKm:null,autoRestEnabled:false,revision:1}),{status:409});assert.equal((await f.api()).autoRestEnabled,true);
 await deleteUserData(f.db,'owner');assert.equal(f.raw.prepare('SELECT count(*) n FROM pejlo_rest_reports').get().n,0);assert.equal(f.raw.prepare('SELECT count(*) n FROM pejlo_rest_wear').get().n,0);
});
test('attachment history is written with the profile revision and a failed save creates no wear event',async()=>{
 const f=await fixture(),account={localId:'owner'};
 await familyAPI(f.db,account,{action:'save',identifier:id,revision:1,profile:{...f.profile,attachment:{...f.profile.attachment,state:'removed'}}},()=>{});
 assert.equal(f.raw.prepare('SELECT worn FROM pejlo_rest_wear').get().worn,0);
 await assert.rejects(()=>familyAPI(f.db,account,{action:'save',identifier:id,revision:1,profile:f.profile},()=>{}),{status:409});
 assert.equal(f.raw.prepare('SELECT count(*) n FROM pejlo_rest_wear').get().n,1);
});
