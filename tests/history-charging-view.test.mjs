import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {types} from '../packages/shared/profiles.js';
import {danishDate,routeAnalysis} from '../packages/shared/history.js';
import {formatDistance} from '../packages/shared/geo.js';

test('history inspection is opt-in for animals and clears when profiles change',async()=>{
 const controls=new Map(),requests=[];
 const element=()=>({checked:false,hidden:false,value:'',textContent:'',replaceChildren(){},append(){}});
 const $=selector=>{if(!controls.has(selector))controls.set(selector,element());return controls.get(selector);};
 let profile={id:'loui',name:'Loui',type:'cat',trackerId:'317309',homeConfirmed:false};
 const context={types,danishDate,routeAnalysis,formatDistance,structuredClone,URLSearchParams,clearInterval,setInterval,
  document:{querySelector:$,addEventListener(){},createElement:element},createMap:()=>({clear(){},async layer(){},profile(){},fit(){}})};
 const source=readFileSync('apps/web/src/features/history-view.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function createHistoryView','function createHistoryView');
 runInNewContext(source+';this.createHistoryView=createHistoryView;',context);
 const view=context.createHistoryView({request:async path=>{requests.push(path);return {route:[],historyAvailable:true,chargingExcluded:4};},selected:()=>profile,layer:()=>'',key:()=>'',notice(){}});
 await view.load();assert.equal($('#history-charging-wrap').hidden,false);assert.ok(!requests.at(-1).includes('includeCharging'));
 assert.match($('#history-status').textContent,/opladningspunkter/);
 $('#history-charging').checked=true;await $('#history-charging').onchange();assert.ok(requests.at(-1).includes('includeCharging=1'));
 view.clear();assert.equal($('#history-charging').checked,false);assert.equal($('#history-charging-wrap').hidden,true);
 profile={...profile,id:'car',type:'car'};$('#history-charging').checked=true;await view.load();assert.equal($('#history-charging-wrap').hidden,true);assert.ok(!requests.at(-1).includes('includeCharging'));
 view.clear();profile={...profile,id:'another-cat',type:'cat'};await view.load();assert.ok(!requests.at(-1).includes('includeCharging'));
});
