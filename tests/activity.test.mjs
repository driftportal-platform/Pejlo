import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {activityAPI} from '../apps/api/activity.js';
import {ensureFamily,familyAPI} from '../apps/api/family.js';
import {ensureNotifications} from '../apps/api/notifications.js';
import {deleteUserData} from '../apps/api/user-data.js';
import {handleAPI} from '../apps/api/worker.js';
import {activityGps,mergeActivity,activityDates,activityAdvice,animalType,activityCsv} from '../packages/shared/activity.js';
import {createActivity} from '../dist/src/features/activity.js';
import {danishDate} from '../packages/shared/history.js';

const identifier='080608317309',day=danishDate(),profileId='loui';
async function fixture(){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT)');
 const db={prepare(sql){const s=raw.prepare(sql);let a=[];return {bind(...v){a=v;return this;},async first(){return s.get(...a)||null;},async run(){return s.run(...a);},async all(){return {results:s.all(...a)};}};}};
 await ensureFamily(db);raw.prepare('INSERT INTO trackers VALUES(?,?)').run(identifier,'owner');raw.prepare('INSERT INTO pejlo_profiles(identifier,owner_uid,profile) VALUES(?,?,?)').run(identifier,'owner',JSON.stringify({id:profileId,type:'cat',trackerId:identifier}));
 for(const [uid,role] of [['editor','editor'],['viewer','viewer']])raw.prepare('INSERT INTO pejlo_members(identifier,uid,email,role) VALUES(?,?,?,?)').run(identifier,uid,uid+'@example.com',role);
 const query={profileId,identifier,type:'cat',from:day,to:day};
 const api=(uid='owner',input=null,extra={})=>activityAPI({db,uid,query:{...query,...extra},input:input?{...query,...input,...extra}:null});
 return {raw,db,api,query};
}
test('goals and day totals persist with revision checks and original daily goal snapshots',async()=>{
 const f=await fixture();await f.api('owner',{action:'goal',goalKm:2,revision:0});
 await f.api('owner',{action:'day',day,km:0,restHours:6.5,note:'Rolig dag',revision:0});
 await f.api('owner',{action:'goal',goalKm:3,revision:1});
 const a=await f.api();assert.equal(a.settings.goal_km,3);assert.equal(a.entries[0].km,0);assert.equal(a.entries[0].goal_km,2);assert.equal(a.entries[0].rest_hours,6.5);
 await f.api('owner',{action:'day',day,km:1.5,restHours:null,note:'Rettet',revision:1});assert.equal((await f.api()).entries[0].goal_km,2);
 await assert.rejects(()=>f.api('owner',{action:'day',day,km:4,restHours:2,note:'stale',revision:1}),{status:409});
 await f.api('owner',{action:'delete',day,revision:2});assert.equal((await f.api()).entries.length,0);
});
test('shared readers can read, editors can edit, and revocation denies access',async()=>{
 const f=await fixture();await f.api('editor',{action:'day',day,km:2,restHours:null,note:'Tur',revision:0});
 const r=await f.api('viewer');assert.equal(r.canEdit,false);assert.equal(r.entries[0].km,2);assert.equal(r.entries[0].actor_uid,undefined);
 await assert.rejects(()=>f.api('viewer',{action:'goal',goalKm:4,revision:0}),{status:403});await assert.rejects(()=>f.api('outsider'),{status:403});
 f.raw.prepare('DELETE FROM pejlo_members WHERE uid=?').run('editor');await assert.rejects(()=>f.api('editor'),{status:403});
});
test('private profiles work without trackers and remain account-isolated, including after linking',async()=>{
 const f=await fixture();await f.api('owner',{action:'day',day,km:1.1,restHours:0,note:'',revision:0},{identifier:''});
 assert.equal((await f.api()).entries[0].km,1.1,'same owner/profile retains data after linking');
 assert.equal((await f.api('other',null,{identifier:''})).entries.length,0);
 await f.api('other',{action:'goal',goalKm:8,revision:0},{identifier:''});assert.equal((await f.api()).settings.goal_km,null);
});
test('input validation rejects invalid dates, non-animal linked profiles and impossible values',async()=>{
 const f=await fixture();
 for(const change of [{km:-1},{km:501},{restHours:25},{restHours:'4'},{km:NaN},{note:'x'.repeat(201)},{day:'2026-02-30'},{day:'2099-01-01'},{km:null,restHours:null,note:''}])await assert.rejects(()=>f.api('owner',{action:'day',day,km:1,restHours:null,note:'',revision:0,...change}),{status:400});
 await assert.rejects(()=>f.api('owner',{action:'goal',goalKm:0,revision:0}),{status:400});
 await assert.rejects(()=>f.api('owner',null,{type:'car'}),{status:400});f.raw.prepare('UPDATE pejlo_profiles SET profile=?').run(JSON.stringify({id:profileId,type:'car'}));await assert.rejects(()=>f.api(),{status:409});
});
test('simultaneous edits do not silently overwrite a day',async()=>{
 const f=await fixture();const input={action:'day',day,km:1,restHours:null,note:'',revision:0};
 const results=await Promise.allSettled([f.api('owner',input),f.api('editor',input)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
});
test('account deletion removes owned activity and anonymizes contributions to another owner',async()=>{
 const f=await fixture();await f.api('editor',{action:'day',day,km:1,restHours:null,note:'',revision:0});await f.api('editor',{action:'goal',goalKm:2,revision:0},{identifier:'',profileId:'mine'});
 await deleteUserData(f.db,'editor');assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_activity_settings WHERE owner_uid=?').get('editor').n,0);assert.equal(f.raw.prepare('SELECT actor_uid FROM pejlo_activity_days').get().actor_uid,null);
});
test('authenticated activity API works with no Traccar credentials and blocks unauthenticated access',async()=>{
 const f=await fixture(),url='https://example.test/api/activity?'+new URLSearchParams({...f.query,identifier:''});let calls=0;
 const fetcher=async()=>{calls++;return Response.json({users:[{localId:'owner',emailVerified:true}]});};
 const a=await handleAPI(new Request(url,{headers:{Authorization:'Bearer test'}}),{DB:f.db},fetcher);assert.equal(a.status,200);assert.equal(calls,1);assert.equal(a.headers.get('cache-control'),'no-store');
 assert.equal((await handleAPI(new Request(url),{DB:f.db},fetcher)).status,401);
});
test('GPS coverage excludes gaps, spikes and cross-midnight pairs without creating sleep',()=>{
 const t=Date.parse('2026-11-20T10:00:00Z'),p=(seconds,lat=56.5)=>({lat,lon:8.3,timestamp:t+seconds*1000,valid:true});
 const a=activityGps([p(0),p(120),p(240,56.5003),p(1200,56.5003),p(1201,57.5)],'cat',t+2000000);
 assert.equal(a.days[0].observedMinutes,4);assert.equal(a.days[0].quietMinutes,2);assert.ok(a.days[0].km>0);assert.equal(a.rejected,2);
 const mid=Date.parse('2026-11-20T22:59:00Z');const b=activityGps([{lat:56.5,lon:8.3,timestamp:mid},{lat:56.5002,lon:8.3,timestamp:mid+120000}],'cat',mid+200000);assert.equal(b.days.length,2);assert.ok(b.days.every(d=>d.km===null));
 assert.equal(activityGps([p(0)],'cat',t+200000).days[0].km,null);assert.deepEqual(activityGps([],'cat').days,[]);
});
test('manual distance overrides rather than adds GPS, and missing rest stays unknown',()=>{
 const rows=mergeActivity(['2026-11-20','2026-11-21'],[{day:'2026-11-20',km:0,rest_hours:null}], [{day:'2026-11-20',km:2,observedMinutes:10,quietMinutes:8}]);
 assert.equal(rows[0].km,0);assert.equal(rows[0].gpsKm,2);assert.equal(rows[0].restHours,null);assert.equal(rows[1].km,null);assert.equal(rows[1].quietMinutes,null);
});
test('Danish dates and species guidance do not introduce fixed medical kilometre targets',()=>{
 assert.equal(activityDates('2026-10-24','2026-10-26',Date.parse('2026-11-24')).length,3);assert.throws(()=>activityDates('2026-10-01','2026-11-24',Date.parse('2026-11-24T18:00Z')));
 assert.equal(animalType('cat'),true);assert.equal(animalType('car'),false);assert.equal(animalType('__proto__'),false);
 for(const type of ['cat','dog','horse','animal']){const a=activityAdvice(type);assert.ok(a.text.length>50);assert.equal(a.km,undefined);}
});

function uiFixture(){
 class E{constructor(){this.children=[];this._value='';}set value(v){this._value=String(v);}get value(){return this._value;}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];}focus(){}removeAttribute(k){delete this[k];}}
 const keys=['day-fields','goal-fields','gps','load','rows','status','gps-status','summary','progress','km','rest','note','title','advice','source','day','from','to','goal','delete','goal-form','day-form','export'];
 const fields=Object.fromEntries(keys.map(k=>[k,new E()]));const root=new E();root.ownerDocument={createElement:()=>new E()};root.querySelector=k=>fields[k.slice(15,-1)];
 let profile={id:profileId,type:'cat',trackerId:identifier,name:'Loui'},resolve,error=false,gpsError=false,gpsDeferred=null,gpsResult={route:[],historyAvailable:true};const calls=[];
 const result=()=>({canEdit:true,from:fields.from.value,to:fields.to.value,settings:{goal_km:2,revision:1},entries:[]});
 const request=async(path,body)=>{calls.push({path,body});if(error)throw Error('Konflikt');if(resolve)return new Promise(r=>resolve(r));if(path.startsWith('tracker?')){if(gpsError)throw Error('GPS-forbindelsen fejlede');if(gpsDeferred)return new Promise(r=>gpsDeferred(r));return gpsResult;}return result();};
 const ui=createActivity({root,selected:()=>profile,request,notice:()=>{}});
 return {ui,root,fields,calls,setProfile:v=>profile=v,setError:v=>error=v,setDeferred:f=>resolve=f,setGps:v=>gpsResult=v,setGpsError:v=>gpsError=v,setGpsDeferred:v=>gpsDeferred=v,result};
}
test('animal UI stays hidden for objects and sends no activity request',async()=>{
 const f=uiFixture();f.setProfile({id:'car',type:'car'});await f.ui.load();assert.equal(f.root.hidden,true);assert.equal(f.calls.length,0);
});
test('GPS rendering preserves unsaved kilometre, rest and goal fields; save conflicts preserve drafts',async()=>{
 const f=uiFixture();await f.ui.load();f.fields.km.value='3.25';f.fields.rest.value='6.5';f.fields.goal.value='4';await f.fields.gps.onclick();
 assert.equal(f.fields.km.value,'3.25');assert.equal(f.fields.rest.value,'6.5');assert.equal(f.fields.goal.value,'4');
 f.setError(true);f.fields['day-form'].onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(f.calls.at(-1).body.km,3.25);assert.equal(f.fields.km.value,'3.25');assert.match(f.fields.status.textContent,/Konflikt/);
});
test('late activity loads cannot expose the previous profile after a switch',async()=>{
 const f=uiFixture();let finish;f.setDeferred(r=>finish=r);const pending=f.ui.load();f.setProfile({id:'other',type:'dog',name:'Hund'});f.ui.sync();finish(f.result());await pending;assert.equal(f.fields.rows.children.length,0);assert.equal(f.fields['day-fields'].disabled,true);
});

test('CSV preserves unknown values, quotes notes and neutralizes spreadsheet formulas',()=>{
 const row=mergeActivity([day],[{day,km:0,rest_hours:null,note:'=HYPERLINK("x")'}])[0];const csv=activityCsv([row]);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"0"'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));assert.ok(!csv.includes('undefined'));
});
test('clearing an unlinked profile removes only that owner profile and its goals',async()=>{
 const f=await fixture();await f.api('owner',{action:'goal',goalKm:2,revision:0});await f.api('owner',{action:'day',day,km:2,restHours:null,note:'',revision:0});await f.api('owner',{action:'clear'},{identifier:''});assert.equal((await f.api()).entries.length,0);assert.equal((await f.api()).settings.goal_km,null);
});
test('owner removal of a shared profile also removes its motion data, while leaving only revokes access',async()=>{
 const f=await fixture();await ensureNotifications(f.db);await f.api('owner',{action:'day',day,km:1,restHours:2,note:'',revision:0});
 await familyAPI(f.db,{localId:'viewer'},{action:'leave',identifier});assert.equal((await f.api()).entries.length,1);
 await familyAPI(f.db,{localId:'owner'},{action:'delete',identifier});assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_activity_days').get().n,0);
});
test('GPS estimates ignore future, approximate, invalid and duplicate positions',()=>{
 const t=Date.now()-120000,p={lat:56.5,lon:8.3,timestamp:t,valid:true};
 const a=activityGps([p,{...p},{...p,approximate:true,timestamp:t+1000},{...p,valid:false,timestamp:t+2000},{...p,timestamp:t+3600000}],'cat');
 assert.equal(a.days[0].points,1);assert.equal(a.days[0].km,null);
});

test('motion history automatically fetches GPS and displays its distance without a separate click',async()=>{
 const f=uiFixture(),at=Date.now()-240000;f.setGps({historyAvailable:true,route:[{lat:56.5,lon:8.3,timestamp:at},{lat:56.5005,lon:8.3,timestamp:at+120000}]});
 await f.ui.load();await new Promise(r=>setImmediate(r));assert.equal(f.calls.filter(c=>c.path.startsWith('tracker?')).length,1);assert.match(f.fields.summary.textContent,/Distance i perioden/);assert.match(f.fields['gps-status'].textContent,/2 GPS-punkter/);
});
test('profile renaming updates motion heading without clearing the history or requesting data',async()=>{
 const f=uiFixture();await f.ui.load();await new Promise(r=>setImmediate(r));const count=f.calls.length;
 f.setProfile({id:profileId,type:'cat',trackerId:identifier,name:'Misser'});f.ui.sync();assert.equal(f.fields.title.textContent,'Motion og hvile for Misser');assert.equal(f.calls.length,count);assert.equal(f.fields['day-fields'].disabled,false);
});
test('GPS failures remain distinct from absent records and do not block manual registration',async()=>{
 const f=uiFixture();f.setGpsError(true);await f.ui.load();await new Promise(r=>setImmediate(r));assert.match(f.fields.summary.textContent,/GPS-afstand kunne ikke hentes/);assert.match(f.fields['gps-status'].textContent,/GPS-forbindelsen fejlede/);assert.equal(f.fields['day-fields'].disabled,false);
});
test('empty and sparse GPS results explain why a distance cannot be computed',async()=>{
 for(const route of [[],[{lat:56.5,lon:8.3,timestamp:Date.now()-10000}]]){
  const f=uiFixture();f.setGps({route,historyAvailable:true});await f.ui.load();await new Promise(r=>setImmediate(r));assert.match(f.fields['gps-status'].textContent,route.length?/Ingen sammenhængende/:/Ingen GPS-punkter/);assert.match(f.fields.summary.textContent,/Ingen brugbare/);
 }
});
test('an obsolete automatic GPS response cannot overwrite a new period or another profile',async()=>{
 const f=uiFixture();let finish;f.setGpsDeferred(r=>finish=r);await f.ui.load();assert.equal(typeof finish,'function');
 f.setGpsDeferred(null);f.setProfile({id:'new-dog',type:'dog',trackerId:'another',name:'Hund'});await f.ui.load();await new Promise(r=>setImmediate(r));
 const text=f.fields['gps-status'].textContent;finish({route:[{lat:56.5,lon:8.3,timestamp:Date.now()-20000},{lat:56.5005,lon:8.3,timestamp:Date.now()-10000}],historyAvailable:true});await new Promise(r=>setImmediate(r));assert.equal(f.fields['gps-status'].textContent,text);assert.equal(f.fields.title.textContent,'Motion og hvile for Hund');
});

test('refreshing a period cancels the pending GPS result from the old period',async()=>{
 const f=uiFixture();let finish;f.setGpsDeferred(r=>finish=r);await f.ui.load();
 const yesterday=new Date(Date.parse(danishDate())-86400000).toISOString().slice(0,10);f.fields.from.value=f.fields.to.value=yesterday;f.setGpsDeferred(null);await f.ui.load();await new Promise(r=>setImmediate(r));
 const text=f.fields['gps-status'].textContent;finish({route:[{lat:56.5,lon:8.3,timestamp:Date.now()-20000},{lat:56.5005,lon:8.3,timestamp:Date.now()-10000}],historyAvailable:true});await new Promise(r=>setImmediate(r));assert.equal(f.fields.rows.children.length,1);assert.equal(f.fields['gps-status'].textContent,text);
});
