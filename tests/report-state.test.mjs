import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {receiveReportState,readReportState} from '../apps/api/report-state.js';
import {reportStatus} from '../packages/shared/report-status.js';
import {deleteUserData} from '../apps/api/user-data.js';
import {handleAPI} from '../apps/api/worker.js';

const identifier='080608317309',key='a'.repeat(64),now=Date.now();
function fixture(){
 const raw=new DatabaseSync(':memory:');raw.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY,owner_uid TEXT)');raw.prepare('INSERT INTO trackers VALUES(?,?)').run(identifier,'owner');
 const db={prepare(sql){const s=raw.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async run(){return s.run(...args);},async first(){return s.get(...args)||null;},async all(){return {results:s.all(...args)};}};}};
 const env={DB:db,TRACCAR_URL:'https://traccar.example.com',TRACCAR_TOKEN:'private',PEJLO_STATUS_KEYS:JSON.stringify({[identifier]:key})};
 const data={identifier,serverUrl:'https://traccar.example.com',sentAt:now,events:[{kind:'sleep_report',receivedAt:now-60000,battery:79}]};
 const request=(body=data,signingKey=key,headers={})=>{const text=JSON.stringify(body);return new Request('https://pejlo.test/api/tracker/report-state',{method:'POST',headers:{'X-Pejlo-Signature':createHmac('sha256',signingKey).update(text).digest('hex'),...headers},body:text});};
 return {raw,env,data,request};
}

test('signed report metadata is device-bound, replay safe and cannot overwrite newer timestamps',async()=>{
 const f=fixture();await receiveReportState(f.request(),f.env,now);await receiveReportState(f.request(),f.env,now);
 assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_report_state').get().n,1);
 await receiveReportState(f.request({...f.data,events:[{kind:'sleep_report',receivedAt:now-120000,battery:90}]}),f.env,now);
 const result=await readReportState(f.env,identifier);assert.equal(result.lastSleepAt,now-60000);assert.equal(result.sleepBattery,79);
 assert.equal((await readReportState({...f.env,TRACCAR_SOURCE:'another-server'},identifier)).lastSleepAt,null);
 await deleteUserData(f.env.DB,'owner');assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM pejlo_report_state').get().n,0);
});

test('invalid signatures, stale requests, wrong servers and malformed batches cannot publish state',async()=>{
 const f=fixture();
 await assert.rejects(()=>receiveReportState(f.request(f.data,'b'.repeat(64)),f.env,now),{status:401});
 await assert.rejects(()=>receiveReportState(f.request(f.data,key,{Origin:'https://evil.test'}),f.env,now),{status:403});
 await assert.rejects(()=>receiveReportState(f.request({...f.data,extra:'x'.repeat(5000)}),f.env,now),{status:413});
 for(const change of [{sentAt:now-300001},{events:[{kind:'sleep_report',receivedAt:now+120000}]},{events:[{kind:'sleep_report',receivedAt:now-86400001}]},{events:[f.data.events[0],{kind:'wake',receivedAt:now}]}])await assert.rejects(()=>receiveReportState(f.request({...f.data,...change}),f.env,now),{status:400});
 await assert.rejects(()=>receiveReportState(f.request({...f.data,serverUrl:'https://old.example.com'}),f.env,now),{status:409});
 assert.equal(f.raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='pejlo_report_state'").get().n,0);
 const unconfigured=await handleAPI(f.request(),{...f.env,PEJLO_STATUS_KEYS:''},()=>{throw Error('Must not call Firebase');});assert.equal(unconfigured.status,401);
});

test('sleep evidence expires, heartbeats do not prolong it and reporting never becomes animal activity',()=>{
 const data={device:{status:'online'},reportState:{lastSleepAt:now-60000,lastHeartbeatAt:now}};
 assert.equal(reportStatus(data,now).tone,'sleep');
 const later={...data,reportState:{...data.reportState,lastQueryReportAt:now-1000}};
 assert.equal(reportStatus(later,now).tone,'unknown');assert.equal(reportStatus(later,now).label,'Dvale: ukendt');assert.match(reportStatus(later,now).note,/ikke.*dvale nu/);
 assert.equal(reportStatus(data,now+900000).tone,'unknown');
 assert.equal(reportStatus({...data,device:{status:'offline'}},now).tone,'unknown');
 assert.equal(reportStatus({reportState:{lastSleepAt:now+120000}},now).sleepAt,null);
 assert.equal(reportStatus(null,now).tone,'unknown');
});

test('normal tracker readers receive status only through their existing tracker access',async()=>{
 const f=fixture();await receiveReportState(f.request(),f.env,now);let uid='owner';
 const fetcher=async url=>{
  if(url.includes('accounts:lookup'))return Response.json({users:[{localId:uid,emailVerified:true}]});
  if(url.includes('/api/devices?'))return Response.json([{id:7,uniqueId:identifier,status:'online'}]);
  if(url.includes('/api/reports/route?'))return Response.json([]);
  throw Error('Unexpected network call');
 };
 const request=()=>handleAPI(new Request('https://pejlo.test/api/tracker?identifier='+identifier,{headers:{Authorization:'Bearer login'}}),f.env,fetcher);
 const response=await request();assert.equal(response.status,200);assert.equal((await response.json()).reportState.lastSleepAt,now-60000);
 uid='stranger';assert.equal((await request()).status,403);
});


test('current sleep status stays unknown despite fresh reporting and a historical sleep timestamp',()=>{
 const d={device:{status:'online'},reportState:{lastSleepAt:now-8*3600000,lastPositionReportAt:now-60000}};
 const r=reportStatus(d,now);assert.equal(r.label,'Dvale: ukendt');assert.match(r.note,/Seneste dvalerapport/);assert.match(r.note,/ikke.*dvale nu/);assert.doesNotMatch(r.note,/bekræftet/);
 assert.equal(reportStatus({device:{status:'online'},reportState:{lastSleepAt:now-60000}},now).label,'Dvale: rapport modtaget');
 assert.equal(reportStatus({device:{status:'offline'},reportState:{lastSleepAt:now-60000}},now).label,'Dvale: ukendt');
});
