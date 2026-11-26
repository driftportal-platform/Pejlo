import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindMapTools} from '../apps/web/src/features/map-tools.js';
function fixture(){
 const element=()=>({attrs:{},handlers:[],setAttribute(k,v){this.attrs[k]=v;},addEventListener(type,fn,capture=false){this.handlers.push({type,fn,capture});},fire(type,event={},capture=false){for(const h of this.handlers)if(h.type===type&&h.capture===capture)h.fn(event);}});
 const button=element(),dialog=element(),closeButton=element();dialog.open=false;dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.fire('close');};
 const tools=bindMapTools({button,dialog,closeButton});return {button,dialog,closeButton,tools};
}
test('map tools open and close with accessible state, backdrop and native dialog close events',()=>{
 const f=fixture();assert.equal(f.button.attrs['aria-expanded'],'false');f.button.fire('click');assert.equal(f.dialog.open,true);assert.equal(f.button.attrs['aria-expanded'],'true');
 f.closeButton.fire('click');assert.equal(f.dialog.open,false);assert.equal(f.button.attrs['aria-expanded'],'false');
 f.button.fire('click');f.dialog.fire('click',{target:f.dialog});assert.equal(f.dialog.open,false);
 f.button.fire('click');f.tools.close();assert.equal(f.button.attrs['aria-expanded'],'false');
});
test('map actions close before existing handlers while position requests and view controls remain open',()=>{
 for(const id of ['center-loui','map-fence','map-trips','map-pause','fit-route','set-map-home']){
  const f=fixture();f.button.fire('click');const target={closest:()=>({id})};f.dialog.fire('click',{target},true);assert.equal(f.dialog.open,false,id+' must reveal the map or next dialog before its handler');
 }
 for(const id of ['', 'show-route','show-home','follow-tracker']){const f=fixture();f.button.fire('click');f.dialog.fire('click',{target:{closest:()=>({id})}},true);assert.equal(f.dialog.open,true);}
});
