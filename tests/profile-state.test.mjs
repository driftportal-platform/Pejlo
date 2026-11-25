import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profileState,renderProfileState} from '../dist/src/features/profile-state.js';
const now=Date.parse('2026-11-25T10:00:00Z'),id='080608317309';
const profile={id:'loui',name:'Loui',type:'cat',trackerId:id,attachment:{trackerId:id,state:'worn',since:now-3600000}};
const data={source:'traccar',device:{identifier:id,status:'online',lastContact:now-1000},telemetry:{receivedAt:now-1000,charging:false},reportState:{lastPositionReportAt:now-1000}};
test('one profile state prioritizes offline, charging and a fresh sleep report over online',()=>{
 assert.equal(profileState(data,profile,now).label,'Online');
 assert.equal(profileState({...data,telemetry:{receivedAt:now,charging:true}},profile,now).label,'Oplader');
 const sleep={...data,reportState:{lastSleepAt:now-500}};
 assert.equal(profileState(sleep,profile,now).label,'Dvale');
 assert.equal(profileState({...sleep,device:{...data.device,status:'offline'},telemetry:{receivedAt:now,charging:true}},profile,now).label,'Offline');
 assert.equal(profileState({...data,reportState:{lastSleepAt:now-3600000,lastPositionReportAt:now-1000}},profile,now).label,'Online','yesterday sleep cannot look current');
});
test('active requires movement and possible rest remains an estimate in the same field',()=>{
 const moving=[0,1].map(i=>({timestamp:now-120000+i*120000,lat:56.5+i*.0004,lon:8.3,valid:true,speedKph:3,charging:false}));
 assert.equal(profileState({...data,restSamples:moving},profile,now).label,'Aktiv');
 const quiet=Array.from({length:10},(_,i)=>({...moving[0],timestamp:now-(18-i*2)*60000,speedKph:0}));
 const rest=profileState({...data,restSamples:quiet},profile,now);assert.equal(rest.label,'Mulig hvile');assert.match(rest.detail,/ikke målt søvn/);
 assert.equal(profileState({...data,restSamples:quiet},profile,now+360000).label,'Afventer');
});
test('profile switches, unknown connections, unlinked and demo data never reuse a live state',()=>{
 assert.equal(profileState(data,{...profile,trackerId:'another'},now).label,'Afventer');
 assert.equal(profileState({...data,source:'demo'},profile,now).label,'Afventer');
 assert.equal(profileState(data,{name:'Cykel'},now).label,'Ikke tilknyttet');
 assert.equal(profileState({...data,device:{...data.device,status:'unknown'}},profile,now).label,'Ukendt');
});
test('rendering replaces the one status label and clears the badge when a profile disappears',()=>{
 const root={textContent:'',dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
 renderProfileState(root,data,profile,now);assert.equal(root.textContent,'Online');assert.equal(root.hidden,false);assert.match(root.attrs['aria-label'],/Trackerstatus: Online/);
 renderProfileState(root,{...data,device:{...data.device,status:'offline'}},profile,now);assert.equal(root.textContent,'Offline');assert.equal(root.dataset.tone,'offline');
 renderProfileState(root,null,null,now);assert.equal(root.hidden,true);assert.equal(root.dataset.tone,'unknown');
});
