import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderHistoryChart,renderActivityOverview} from '../apps/web/src/features/history-charts.js';
import {cleanAttachment,updateAttachment,attachmentText} from '../packages/shared/attachment.js';
import {newProfile,cleanProfile} from '../packages/shared/profiles.js';
import {createBatteryControls} from '../apps/web/src/features/battery-controls.js';

export function dom(){
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.events={};this.ownerDocument=doc;this.textContent='';}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=[...children];this.textContent='';}
  setAttribute(key,value){this.attrs[key]=String(value);}getAttribute(key){return this.attrs[key];}
  addEventListener(event,fn){this.events[event]=fn;}
 }
 const doc={createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
 return {root:doc.createElement('div'),doc};
}
const all=(root,predicate)=>[...(predicate(root)?[root]:[]),...root.children.flatMap(child=>all(child,predicate))];
const text=root=>root.textContent+root.children.map(text).join(' ');

test('charts preserve explicit zero and gaps, without drawing through missing battery readings',()=>{
 const {root}=dom();renderHistoryChart(root,{title:'Batteri',labels:['a','b','c','d','e'],values:[100,99,null,0,2],unit:'%',kind:'line',max:100});
 assert.equal(all(root,e=>e.tag==='polyline').length,2);assert.equal(all(root,e=>e.tag==='circle').length,4);
 assert.ok(all(root,e=>e.attrs['aria-label']==='d: 0 %').length);assert.match(text(root),/4 af 5/);
 const point=all(root,e=>e.tag==='circle')[3];point.events.click();assert.match(text(root),/e: 2 %/);
 assert.ok(!JSON.stringify(root.attrs).includes('NaN'));
});

test('all-unknown charts remain unknown while all-zero charts show measured zero',()=>{
 const {root}=dom();renderHistoryChart(root,{title:'Hvile',labels:['a','b'],values:[null,undefined],unit:'timer'});assert.equal(all(root,e=>e.tag==='svg').length,0);assert.match(text(root),/Ingen målinger/);
 renderHistoryChart(root,{title:'Hvile',labels:['a','b'],values:[0,0],unit:'timer'});assert.equal(all(root,e=>e.tag==='rect').length,2);assert.match(text(root),/2 af 2/);
});

test('status meters cap their fill but retain an exceeded kilometre goal and manual rest',()=>{
 const {root}=dom();renderActivityOverview(root,[{day:'2026-11-24',km:3,restHours:0,source:'manual'}],2,'2026-11-24');
 const meters=all(root,e=>e.tag==='meter');assert.equal(meters[0].value,2);assert.equal(meters[0].max,2);assert.equal(meters[1].value,0);assert.match(text(root),/3 km/);assert.match(text(root),/0 timer/);
 renderActivityOverview(root,[{day:'2026-11-23',km:null,restHours:null,goalKm:4}],2,'2026-11-24');assert.equal(all(root,e=>e.tag==='meter').length,0);assert.match(text(root),/Ukendt/);assert.match(text(root),/Mål ved registrering: 4/);
});

test('attachment confirmations are bound to a tracker, timestamped and do not invent historic rest',()=>{
 const now=Date.now(),value=updateAttachment(null,'worn','317309',now);
 assert.equal(value.since,now);assert.deepEqual(updateAttachment(value,'worn','317309',now+1000),value);
 assert.equal(updateAttachment(value,'removed','317309',now+1000).since,now+1000);
 assert.equal(cleanAttachment(value,'other',now),null);assert.equal(cleanAttachment({...value,since:now+120000},'317309',now),null);
 assert.equal(updateAttachment(value,'unknown','317309',now),null);
 const profile=cleanProfile({...newProfile('Loui','cat'),trackerId:'317309',attachment:value});assert.deepEqual(profile.attachment,value);assert.match(attachmentText(profile),/påsat Loui/);
 assert.equal(cleanProfile({...profile,trackerId:'another'}).attachment,null);assert.equal(profile.restHours,undefined);
});

test('battery graphs keep tables collapsed and reject an old response after a period or profile change',async()=>{
 const {root,doc}=dom(),fields={};
 for(const name of ['fieldset','select','[data-battery-status]','[data-battery-apply]','[data-battery-refresh]','[data-battery-history]','[data-battery-history-output]','[data-battery-history-status]','[data-battery-days]','[data-battery-history-details]'])fields[name]=doc.createElement('div');
 fields['[data-battery-days]'].value='1';root.querySelector=name=>fields[name]||null;
 let profile={trackerId:'317309'},pending=[];
 const ui=createBatteryControls({root,selected:()=>profile,canEdit:()=>true,notice(){},request:async path=>path.startsWith('battery/history?')?new Promise(resolve=>pending.push(resolve)):{enabled:true}});
 await ui.load();
 const old=fields['[data-battery-history]'].onclick();fields['[data-battery-days]'].value='7';const latest=fields['[data-battery-days]'].onchange();
 const result={count:2,first:{level:100},last:{level:80},buckets:[{at:Date.now()-3600000,battery:100,charging:true,count:1},{at:Date.now(),battery:80,charging:false,count:1}],changes:[]};
 pending[1](result);await latest;const output=fields['[data-battery-history-output]'];assert.equal(all(output,e=>e.tag==='svg').length,2);assert.ok(all(output,e=>e.tag==='details').every(e=>!e.open));assert.match(text(output),/Kommandolog/);
 pending[0]({...result,count:99});await old;assert.match(fields['[data-battery-history-status]'].textContent,/2 gemte/);
 const late=fields['[data-battery-history]'].onclick();profile=null;ui.clear();pending[2](result);await late;assert.equal(output.children.length,0);
});
