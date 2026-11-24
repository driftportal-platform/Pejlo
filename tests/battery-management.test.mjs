import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {managedBattery,runBatteryAutomation,ensureBatteryPolicy} from '../apps/api/battery-management.js';
import {nextBatteryTarget} from '../packages/shared/battery-policy.js';
import {createBatteryPolicy} from '../apps/web/src/features/battery-policy.js';
import {deleteUserData} from '../apps/api/user-data.js';

const identifier='080608317309',uid='owner',start=1800000000000;
function fixture(){
 const raw=new DatabaseSync(':memory:');
 raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT); CREATE TABLE pejlo_profiles(identifier TEXT PRIMARY KEY,owner_uid TEXT,profile TEXT)');
 raw.prepare('INSERT INTO trackers VALUES(?,?)').run(identifier,uid);
 const db={prepare(sql){const s=raw.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async first(){return s.get(...args)||null;},async run(){return s.run(...args);},async all(){return {results:s.all(...args)};}};}};
 const env={DB:db,PEJLO_BATTERY_DEVICES:identifier,TRACCAR_TOKEN:'test',TRACCAR_SOURCE:'one'};
 const device={id:1,uniqueId:identifier,status:'online',positionId:2},sent=[];let code=200,position=null;
 const fetcher=async(url,options={})=>{
  if(url.includes('/commands/send')){sent.push(JSON.parse(options.body));return new Response('',{status:code});}
  const result=url.includes('/commands/types')?[{type:'custom'}]:url.includes('/devices?')?[device]:position?[position]:[];
  return Response.json(result);
 };
 const traccarFetch=(path,options)=>fetcher('https://example.test'+path,options);
 const options={env,identifier,uid,device,traccarFetch,traccar:async path=>(await traccarFetch(path)).json()};
 const call=(input,now=start)=>managedBattery({...options,input,now});
 const tick=(now)=>runBatteryAutomation(env,fetcher,'https://example.test',now);
 const policy=()=>raw.prepare('SELECT * FROM pejlo_battery_policy WHERE source=? AND owner_uid=?').get(env.TRACCAR_SOURCE,uid);
 const seconds=()=>sent.map(s=>parseInt(s.attributes.data.slice(2,-4).replaceAll('7d02','7e').replaceAll('7d01','7d').slice(-4),16));
 return {raw,db,env,device,sent,options,call,tick,policy,seconds,setCode:v=>code=v,setPosition:v=>position=v};
}
const wifi={macs:['28:BD:89:05:5C:10'],samples:[...Array.from({length:3},(_,i)=>({label:'inside',at:1000+i,points:[{mac:'28:BD:89:05:5C:10',rssi:-40}]})),...Array.from({length:3},(_,i)=>({label:'outside',at:2000+i,points:[{mac:'28:BD:89:05:5C:10',rssi:-80}]}))]};
function profile(f,config=wifi){f.raw.prepare('INSERT OR REPLACE INTO pejlo_profiles VALUES(?,?,?)').run(identifier,uid,JSON.stringify({homeWifi:config}));}
function position(at,rssi=-40){return {id:2,deviceId:1,serverTime:new Date(at).toISOString(),deviceTime:new Date(at).toISOString(),network:{wifiAccessPoints:[{macAddress:wifi.macs[0],signalStrength:rssi}]}};}

test('reading settings never enables automation or sends a command',async()=>{
 const f=fixture();assert.equal((await f.call(null)).policy,null);assert.equal(f.sent.length,0);
 await f.tick(start);assert.equal(f.sent.length,0);
});
test('Find restores previous manual interval after expiry with the browser closed',async()=>{
 const f=fixture();await f.call({seconds:120,testConfirmed:true});
 await f.call({action:'find',minutes:5},start+61000);assert.deepEqual(f.seconds(),[120,30]);
 await f.tick(start+120000);assert.deepEqual(f.seconds(),[120,30]);
 await f.tick(start+361000);assert.deepEqual(f.seconds(),[120,30,120]);assert.equal(f.policy().find_until,0);
});
test('offline expiry keeps restoration pending and restores when online',async()=>{
 const f=fixture();await f.call({action:'find',minutes:5});f.device.status='offline';
 await f.tick(start+301000);assert.equal(f.policy().note,'offline');assert.equal(f.sent.length,1);
 f.device.status='online';await f.tick(start+361000);assert.deepEqual(f.seconds(),[30,60]);assert.equal(f.policy().find_until,0);
});
test('uncertain Find send is not repeated, and expiry still requests the normal interval once',async()=>{
 const f=fixture();f.setCode(503);await f.call({action:'find',minutes:5});
 await f.tick(start+61000);await f.tick(start+121000);assert.equal(f.sent.length,1);assert.equal(f.policy().note,'uncertain');
 await f.tick(start+301000);await f.tick(start+361000);assert.deepEqual(f.seconds(),[30,60]);
});
test('manual interval cancels both Find and automatic actions',async()=>{
 const f=fixture();await f.call({action:'find',minutes:5});await f.call({seconds:120,testConfirmed:true},start+61000);
 await f.tick(start+400000);assert.deepEqual(f.seconds(),[30,120]);assert.equal(f.policy().auto_enabled,0);assert.equal(f.policy().find_until,0);
});
test('a manual offline or cooldown rejection preserves the existing Find expiry',async()=>{
 const f=fixture();await f.call({action:'find',minutes:5});
 await assert.rejects(()=>f.call({seconds:120,testConfirmed:true},start+1000),{status:429});assert.equal(f.policy().find_until,start+300000);
 f.device.status='offline';await assert.rejects(()=>f.call({seconds:120,testConfirmed:true},start+61000),{status:409});assert.equal(f.policy().find_until,start+300000);
 f.device.status='online';await f.tick(start+301000);assert.deepEqual(f.seconds(),[30,60]);
});
test('overlapping Find and manual actions cannot both acquire the policy lease',async()=>{
 const f=fixture();
 const results=await Promise.allSettled([f.call({action:'find',minutes:5}),f.call({seconds:120,testConfirmed:true})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.status,409);assert.equal(f.sent.length,1);
});
test('automatic home interval needs three distinct trained fresh samples, then uncertainty restores 60',async()=>{
 const f=fixture();profile(f);f.setPosition(position(start));
 await f.call({action:'auto',enabled:true,testConfirmed:true});assert.deepEqual(f.seconds(),[60]);
 await f.tick(start+1000);assert.equal(f.policy().inside_count,1,'the same sample is not counted twice');
 f.setPosition(position(start+60000));await f.tick(start+60000);assert.deepEqual(f.seconds(),[60]);
 f.setPosition(position(start+120000));await f.tick(start+120000);assert.deepEqual(f.seconds(),[60,120]);
 f.setPosition(position(start+180000,-60));await f.tick(start+180000);assert.deepEqual(f.seconds(),[60,120,60]);
});
test('auto resumes after Find and a stop during cooldown is restored by cron',async()=>{
 const f=fixture();profile(f);f.setPosition(position(start));await f.call({action:'auto',enabled:true,testConfirmed:true});
 await f.call({action:'find',minutes:15},start+61000);await f.call({action:'stop'},start+62000);
 assert.equal(f.policy().note,'cooldown');await f.tick(start+122000);assert.deepEqual(f.seconds(),[60,30,60]);assert.equal(f.policy().auto_enabled,1);
});
test('auto requires explicit consent and training; Find validates duration and online state',async()=>{
 const f=fixture();
 for(const input of [{action:'auto',enabled:true},{action:'auto',enabled:true,testConfirmed:true},{action:'find',minutes:1},{action:'unknown'},{seconds:0}])await assert.rejects(()=>f.call(input));
 f.device.status='offline';await assert.rejects(()=>f.call({action:'find',minutes:5}));assert.equal(f.sent.length,0);
});
test('source, current owner, allowlist and leases prevent unintended automatic commands',async()=>{
 for(const change of ['owner','source','allowlist','lease']){
  const f=fixture();await f.call({action:'find',minutes:5});
  if(change==='owner')f.raw.prepare('UPDATE trackers SET owner_uid=?').run('other');
  if(change==='source')f.env.TRACCAR_SOURCE='two';
  if(change==='allowlist')f.env.PEJLO_BATTERY_DEVICES='';
  if(change==='lease')f.raw.prepare('UPDATE pejlo_battery_policy SET lease_until=?').run(start+999999);
  await f.tick(start+361000);assert.equal(f.sent.length,1,change);
 }
 const f=fixture();await ensureBatteryPolicy(f.db);f.raw.prepare('INSERT INTO pejlo_battery_policy(source,identifier,owner_uid,lease_until) VALUES(?,?,?,?)').run('one',identifier,uid,start+10000);
 await assert.rejects(()=>f.call({action:'find',minutes:5}),{status:409});
});
test('account deletion removes policy so it cannot continue in background',async()=>{
 const f=fixture();await f.call({action:'find',minutes:5});await deleteUserData(f.db,uid);assert.equal(f.policy(),undefined);
});
test('old samples and gaps reset home evidence, never infer home from missing data',()=>{
 let state={auto_enabled:1};
 for(const at of [start,start+60000,start+120000])state=nextBatteryTarget(state,{kind:'inside',at},at).state;
 assert.equal(nextBatteryTarget(state,{kind:'inside',at:start+120000},start+120000).seconds,120);
 assert.equal(nextBatteryTarget(state,{kind:'unknown'},start+130000).seconds,60);
 assert.equal(nextBatteryTarget(state,{kind:'inside',at:start+400000},start+400000).seconds,60);
});
test('policy UI sends an explicit duration and ignores a late response after profile change',async()=>{
 const fields=Object.fromEntries(['fieldset','[data-battery-auto]','[data-battery-auto-save]','[data-battery-policy-status]','[data-battery-find]','[data-battery-find-minutes]','[data-battery-stop]'].map(k=>[k,{}]));
 fields['[data-battery-find-minutes]'].value='15';let resolve,updates=0;const calls=[];
 const ui=createBatteryPolicy({root:{querySelector:k=>fields[k]},selected:()=>({trackerId:identifier}),canEdit:()=>true,updated:()=>updates++,request:(path,input)=>{calls.push(input);return new Promise(r=>resolve=r);}});
 ui.render({enabled:true});const pending=fields['[data-battery-find]'].onclick();assert.equal(calls[0].minutes,15);ui.clear();resolve({enabled:true});await pending;assert.equal(updates,0);assert.equal(fields.fieldset.disabled,true);
});
