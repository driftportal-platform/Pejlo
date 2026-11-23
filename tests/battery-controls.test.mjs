import {test} from 'node:test';
import assert from 'node:assert/strict';
import {batteryControls,batteryEnabled,intervalCommand} from '../apps/api/battery-controls.js';
import {createBatteryControls} from '../apps/web/src/features/battery-controls.js';
const identifier='080608317309';
test('UI reads settings without sending a command and applies the selected interval explicitly',async()=>{
 const fields=Object.fromEntries(['fieldset','select','[data-battery-status]','[data-battery-apply]','[data-battery-refresh]','[data-battery-history]','[data-battery-history-output]','[data-battery-history-status]'].map(k=>[k,{replaceChildren(){}}]));fields.select.value='60';
 const calls=[],root={querySelector:k=>fields[k]};
 const ui=createBatteryControls({root,selected:()=>({trackerId:identifier}),canEdit:()=>true,notice:()=>{},request:async(path,body)=>{calls.push({path,body});return {enabled:true,last:body?{seconds:body.seconds,status:'sent',requested_at:Date.now()}:null};}});
 await ui.load();assert.equal(calls.length,1);assert.equal(calls[0].body,undefined);
 await fields['[data-battery-apply]'].onclick();assert.equal(calls[1].body.seconds,60);assert.match(fields['[data-battery-status]'].textContent,/ikke læst tilbage/);
});
test('late UI results cannot unlock the previous profile after a switch',async()=>{
 const fields=Object.fromEntries(['fieldset','select','[data-battery-status]','[data-battery-apply]','[data-battery-refresh]','[data-battery-history]','[data-battery-history-output]','[data-battery-history-status]'].map(k=>[k,{replaceChildren(){}}]));let profile={trackerId:identifier},resolve;
 const ui=createBatteryControls({root:{querySelector:k=>fields[k]},selected:()=>profile,canEdit:()=>true,notice:()=>{},request:()=>new Promise(r=>resolve=r)});
 const pending=ui.load();profile=null;await ui.load();resolve({enabled:true});await pending;assert.equal(fields.fieldset.disabled,true);
});
function fixture({status=200,online=true,reserved=true,throws=false}={}){
 const sent=[],updates=[];let row=null;
 const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async run(){if(sql.startsWith('UPDATE')){updates.push(args);row.status=args[0];}return {success:true};},async first(){if(sql.startsWith('SELECT'))return row;if(!reserved)return null;row={seconds:args[1],requested_at:args[2],status:'pending'};return {identifier};}};}};
 return {sent,updates,options:{env:{DB:db,PEJLO_BATTERY_DEVICES:identifier},identifier,device:{id:1,status:online?'online':'offline'},traccar:async()=>[{type:'custom'}],traccarFetch:async(path,options)=>{sent.push(JSON.parse(options.body));if(throws)throw Error('Timeout');return {ok:status>=200&&status<300,status};},now:1800000000000}};
}
test('60-second frame equals the command verified on the physical tracker',()=>{
 assert.equal(intervalCommand(identifier,60,1),'7e810300090806083173090001010000f1150300003c1d7e');
 for(const seconds of [30,60,120]){
  const h=intervalCommand(identifier,seconds,125).slice(2,-2).replaceAll('7d02','7e').replaceAll('7d01','7d');
  assert.equal(h.match(/../g).map(x=>parseInt(x,16)).reduce((a,b)=>a^b,0),0);
 }
 assert.throws(()=>intervalCommand(identifier,0));assert.throws(()=>intervalCommand('other',60));
});
test('capabilities require an explicit server-side device entry; disabled requests send nothing',async()=>{
 const f=fixture();f.options.env.PEJLO_BATTERY_DEVICES='';assert.equal(batteryEnabled(f.options.env,identifier),false);
 assert.deepEqual(await batteryControls(f.options),{enabled:false});
 await assert.rejects(()=>batteryControls({...f.options,input:{seconds:60}}),{status:409});assert.equal(f.sent.length,0);
});
test('posting requests only validated intervals and never claims a tracker acknowledgement',async()=>{
 const f=fixture(),result=await batteryControls({...f.options,input:{seconds:60}});
 assert.equal(result.last.status,'sent');assert.equal(result.confirmed,undefined);
 assert.equal(f.sent[0].attributes.noQueue,true);assert.equal(f.sent[0].type,'custom');
 assert.equal((await batteryControls(f.options)).last.seconds,60);
});
test('offline, unsupported, too-frequent and unconfirmed experimental requests send nothing',async()=>{
 for(const setup of [{online:false},{reserved:false}]){const f=fixture(setup);await assert.rejects(()=>batteryControls({...f.options,input:{seconds:60}}));assert.equal(f.sent.length,0);}
 for(const input of [{seconds:120},{seconds:0},{seconds:300}]){const f=fixture();await assert.rejects(()=>batteryControls({...f.options,input}));assert.equal(f.sent.length,0);}
 const f=fixture();assert.equal((await batteryControls({...f.options,input:{seconds:120,testConfirmed:true}})).last.seconds,120);
});
test('queued and lost responses remain uncertain, rather than reporting active settings',async()=>{
 for(const setup of [{status:202},{status:503},{throws:true}]){const f=fixture(setup);await assert.rejects(()=>batteryControls({...f.options,input:{seconds:60}}));assert.equal(f.updates[0][0],'uncertain');}
 const f=fixture({status:400});await assert.rejects(()=>batteryControls({...f.options,input:{seconds:60}}));assert.equal(f.updates[0][0],'rejected');
});
