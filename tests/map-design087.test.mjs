import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFenceEditor} from '../dist/src/features/fence-editor.js';
function fixture(canEdit=true){
 const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',hidden:false,disabled:false,open:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return els.get(id);};
 globalThis.document={querySelector:el,getElementById:el};globalThis.window={};
 const p={id:'loui',home:{lat:56,lon:8,radius:100,shape:'circle'},fencePresets:[],geofenceEnabled:true};const saved=[],notices=[];
 const editor=createFenceEditor({selected:()=>p,canEdit:()=>canEdit,layer:()=> 'streets',key:()=>'',notice:v=>notices.push(v),save:async(...v)=>saved.push(v)});
 return {el,p,saved,notices,editor};
}
test('circle radius previews are drafts, cancel does not change the shared home',async()=>{
 const f=fixture();await f.editor.open();f.el('#editor-radius').value='250';f.el('#editor-radius').oninput();assert.equal(f.el('#editor-radius-value').textContent,'250 m');assert.equal(f.p.home.radius,100);f.el('#editor-close').onclick();assert.equal(f.saved.length,0);assert.equal(f.el('#fence-editor').open,false);
});
test('saving a circle passes the valid draft to the existing persistence callback',async()=>{
 const f=fixture();await f.editor.open();f.el('#editor-name').value='Haven';f.el('#editor-radius').value='250';f.el('#editor-radius').oninput();await f.el('#editor-form').onsubmit({preventDefault(){}});assert.equal(f.saved[0][0].radius,250);assert.equal(f.saved[0][1],'Haven');assert.equal(f.saved[0][3],'loui');
});
test('polygon needs at least three points and viewers cannot open the editor',async()=>{
 const f=fixture();await f.editor.open();f.el('#editor-shape').value='polygon';f.el('#editor-shape').onchange();assert.equal(f.el('#editor-save').disabled,true);assert.equal(f.el('#editor-radius-row').hidden,true);
 const viewer=fixture(false);await viewer.editor.open();assert.equal(viewer.el('#fence-editor').open,false);assert.equal(viewer.notices.length,1);
});
