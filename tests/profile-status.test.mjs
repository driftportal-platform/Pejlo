import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profileStatuses,renderProfileStatus,createProfileStatusHelp} from '../dist/src/features/profile-status.js';
const now=Date.now(),id='080608317309',profile={type:'cat',attachment:{state:'worn',since:now-3600000,trackerId:id},trackerId:id,homeWifi:{macs:['28:BD:89:05:5C:10']}};
const moving=[0,1].map(i=>({timestamp:now-121000+i*120000,lat:56.5+i*.0004,lon:8.3,valid:true,charging:false,speedKph:3}));
const data={restSamples:moving,source:'traccar',device:{identifier:id,status:'online'},position:{timestamp:now-1000,valid:true},telemetry:{receivedAt:now-1000,battery:80,batteryMeasuredAt:now-1000,charging:false,rssi:21,rssiMax:31,satellites:17,wifiMeasuredAt:now-1000,wifiAccessPoints:[{mac:'28:BD:89:05:5C:10',rssi:-60}]},reportState:{lastPositionReportAt:now-1000}};
const map=(d=data,p=profile,at=now)=>Object.fromEntries(profileStatuses(d,p,at).map(s=>[s.key,s]));
test('compact profile statuses show dated reporting, GPS, mobile, home Wi-Fi, battery and charging',()=>{
 const s=map();for(const name of ['active','gps','mobile','wifi','battery'])assert.equal(s[name].tone,'good',name);
 assert.equal(s.charging.tone,'bad');assert.match(s.charging.detail,/ikke/);assert.equal(s.sleep.tone,'unknown');
 assert.match(s.active.detail,/GPS/);
});
test('sleep evidence, weak signals and charging use independent indicators',()=>{
 const s=map({...data,restSamples:[],reportState:{lastSleepAt:now-500},telemetry:{...data.telemetry,charging:true,rssi:0,satellites:0,battery:0,wifiAccessPoints:[{mac:'28:BD:89:05:5C:10',rssi:-85}]}});
 assert.equal(s.sleep.tone,'unknown');assert.equal(s.active.tone,'unknown');assert.equal(s.charging.tone,'good');
 for(const name of ['gps','mobile','battery','wifi'])assert.equal(s[name].tone,'bad',name);
});
test('expired, missing, demo and other-profile data never leave green indicators behind',()=>{
 for(const [d,p] of [[null,profile],[data,{}],[{...data,source:'demo'},profile],[{...data,device:{identifier:'another',status:'online'}},profile]])assert.ok(Object.values(map(d,p)).every(s=>s.tone==='unknown'));
 const old=map(data,profile,now+3600000);assert.ok(Object.values(old).every(s=>s.tone==='unknown'));
 const off=map({...data,device:{...data.device,status:'offline'}});assert.equal(off.active.tone,'bad');assert.equal(off.battery.tone,'unknown');assert.equal(off.wifi.tone,'unknown');
});
test('GPS uncertainty and query replies do not imply accurate GPS or an awake animal',()=>{
 const s=map({...data,gpsUncertain:true,reportState:{lastSleepAt:now-10000,lastQueryReportAt:now-500}});
 assert.equal(s.sleep.tone,'unknown');assert.equal(s.active.tone,'unknown');assert.equal(s.gps.tone,'bad');
});

test('the moon shows estimated GPS rest and the pulse no longer treats reporting as movement',()=>{
 const quiet=Array.from({length:10},(_,i)=>({timestamp:now-(18-i*2)*60000,lat:56.5,lon:8.3,valid:true,charging:false,speedKph:0,satellites:15}));
 const s=map({...data,restSamples:quiet});assert.equal(s.sleep.tone,'good');assert.equal(s.active.tone,'unknown');assert.match(s.sleep.detail,/ikke målt søvn/);
 assert.equal(map({...data,restSamples:quiet},profile,now+6*60000).sleep.tone,'unknown');
});
test('profile icons have accessible descriptions and are cleared on profile removal',()=>{
 const doc={createElement(){return {dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}};}},root={ownerDocument:doc,replaceChildren(...items){this.children=items;}};
 renderProfileStatus(root,data,profile,now);assert.equal(root.hidden,false);assert.equal(root.children.length,7);
 for(const child of root.children){assert.equal(child.type,'button');assert.equal(child.attrs['aria-haspopup'],'dialog');assert.ok(child.attrs['aria-label'].includes(':'));assert.match(child.innerHTML,/<svg/);}
 renderProfileStatus(root,null,null,now);assert.equal(root.hidden,true);assert.ok(root.children.every(c=>c.dataset.tone==='unknown'));
});


test('icon activation opens an explanation, updates the reading and closes on profile switch',()=>{
 const doc={createElement(tag){return {tag,children:[],dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},append(...nodes){this.children.push(...nodes);},addEventListener(name,fn){this[name]=fn;},showModal(){this.open=true;},close(){this.open=false;}};}};doc.body=doc.createElement('body');
 const help=createProfileStatusHelp(doc),root=doc.createElement('span');root.ownerDocument=doc;root.replaceChildren=(...nodes)=>root.children=nodes;
 const p={...profile,id:'loui',name:'Loui'};renderProfileStatus(root,data,p,now,help.show);
 root.children[6].onclick();const dialog=doc.body.children[0];assert.equal(dialog.open,true);assert.match(dialog.children[0].children[0].textContent,/Loui.*Opladning/);assert.match(dialog.children[2].textContent,/ikke i sig selv en fejl/);
 help.update({...data,telemetry:{...data.telemetry,charging:true}},p);assert.equal(dialog.children[1].textContent,'Aktuelt: Oplader');
 help.update(data,{...p,id:'another',name:'Hund'});assert.equal(dialog.open,false);
 root.children[0].onclick();assert.equal(dialog.open,true);assert.match(dialog.children[2].textContent,/ikke målt søvn/);
 dialog.children[0].children[1].onclick();assert.equal(dialog.open,false);
});
