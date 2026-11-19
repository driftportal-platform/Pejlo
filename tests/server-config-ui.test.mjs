import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServerConfig} from '../apps/web/src/features/server-config.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('admin requires a fresh successful test and clears credentials on logout',async()=>{
 const nodes=new Map();
 const element=()=>({value:'',textContent:'',disabled:false,hidden:false,children:[],replaceChildren(){this.children=[];},append(n){this.children.push(n);}});
 globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element};
 try{
  const calls=[];
  const request=async(path,body)=>{calls.push(body);if(!body)return {url:'https://demo3.traccar.org',revision:'environment',source:'environment',canSave:true};return {devices:[{identifier:'one',name:'Loui'}],missing:[]};};
  const ui=createServerConfig({request});ui.enable(true);await tick();
  assert.equal(nodes.get('server-activate').disabled,true);
  nodes.get('server-token').value='secret';
  nodes.get('server-form').onsubmit({preventDefault(){}});await tick();
  assert.equal(nodes.get('server-activate').disabled,false);
  nodes.get('server-url').value='https://changed.example';nodes.get('server-url').oninput();
  assert.equal(nodes.get('server-activate').disabled,true);
  await nodes.get('server-activate').onclick();assert.equal(calls.filter(c=>c?.action==='activate').length,0);
  ui.enable(false);assert.equal(nodes.get('server-token').value,'');assert.equal(nodes.get('traccar-server-panel').hidden,true);
 }finally{delete globalThis.document;}
});
