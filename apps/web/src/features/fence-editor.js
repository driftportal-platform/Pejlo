import {cleanHome} from '../shared/profiles.js';
import {validPolygon} from '../shared/fence.js';
import {createMap} from './maps.js';
export function createFenceEditor({selected,layer,key,notice,save,canEdit}){
 const $=s=>document.querySelector(s);let map,profileId,draft,saving=false,generation=0;
 function render(){
  const polygon=$('#editor-shape').value==='polygon';draft.shape=polygon?'polygon':'circle';$('#editor-radius-row').hidden=polygon;$('#editor-undo').hidden=!polygon;$('#editor-radius-value').textContent=draft.radius+' m';$('#editor-count').textContent=polygon?(draft.points?.length||0)+' punkter · mindst 3':'Tryk på kortet for at vælge cirklens centrum.';
  map?.draftHome(draft);$('#editor-save').disabled=saving||(polygon&&!validPolygon(draft.points));
 }
 function close(){if(saving)return;$('#fence-editor').close();map?.clear();}
 async function open(){
  const p=selected();if(!p||!canEdit())return notice('Du har kun læseadgang til profilen.');const gen=++generation;profileId=p.id;draft=structuredClone(p.home);draft.points??=[];$('#editor-name').value=p.fencePresets?.find(f=>f.id===p.activeFenceId)?.name||'';$('#editor-shape').value=draft.shape||'circle';$('#editor-radius').value=draft.radius;$('#editor-status').textContent='';$('#editor-enabled').checked=p.geofenceEnabled;$('#fence-editor').showModal();
  if(!map)map=createMap('editor-map',{notice,onHome:point=>{if(saving)return;if(draft.shape==='polygon'){if(draft.points.length>=50)return notice('Højst 50 punkter.');draft.points.push(point);}else Object.assign(draft,point);render();}});
  await map?.layer(layer(),key());if(gen!==generation||!$('#fence-editor').open)return;map?.profile({...p,homeConfirmed:false},{position:null,route:[]},{showRoute:false,showHome:false});render();map?.fit(p,{position:null,route:[]});
 }
 $('#editor-shape').onchange=render;$('#editor-radius').oninput=()=>{draft.radius=Number($('#editor-radius').value);render();};$('#editor-undo').onclick=()=>{draft.points.pop();render();};$('#editor-close').onclick=close;
 $('#fence-editor').addEventListener('cancel',e=>{e.preventDefault();close();});
 $('#editor-form').onsubmit=async e=>{
  e.preventDefault();if(saving)return;const name=$('#editor-name').value.trim(),home=cleanHome(draft);if(!name||!home)return notice('Giv området et navn, og tegn et gyldigt område.');if(layer()==='demo')return notice('Vælg først et geografisk kortlag på Kort-siden.');if(selected()?.id!==profileId||!canEdit())return close();
  const gen=generation;saving=true;$('#editor-form').inert=true;render();$('#editor-status').textContent='Gemmer området…';
  try{await save(home,name,$('#editor-enabled').checked,profileId);if(gen!==generation)return;saving=false;close();notice('Hjemmeområdet er gemt.');}catch(error){if(gen!==generation)return;$('#editor-status').textContent=error.message||'Området kunne ikke gemmes.';}finally{if(gen!==generation)return;saving=false;$('#editor-form').inert=false;render();}
 };
 return {open,reset(){generation++;saving=false;$('#editor-form').inert=false;$('#fence-editor').close();map?.clear();}};
}
