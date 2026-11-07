import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initPageScroll} from '../apps/web/src/features/page-scroll.js';
function fixture(){
 const children=[],events={},frames=[],calls=[];let modal=false,app={hidden:false};
 const el=()=>({hidden:false,handlers:{},addEventListener(k,v){this.handlers[k]=v}});
 globalThis.document={createElement:el,body:{append(...nodes){children.push(...nodes)}},documentElement:{scrollHeight:2000},querySelector:s=>s==='.app'?app:modal?{}:null,querySelectorAll:()=>[]};
 globalThis.window={scrollY:600,innerHeight:800,scrollTo:o=>{calls.push(o);window.scrollY=o.top},matchMedia:()=>({matches:false}),addEventListener:(k,v,options)=>events[k]={callback:v,options}};
 globalThis.ResizeObserver=class{observe(){}};globalThis.MutationObserver=class{observe(){}};globalThis.requestAnimationFrame=f=>{frames.push(f);return frames.length};
 initPageScroll();return{children,top:children[0],calls,events,app,modal:v=>modal=v,flush(){frames.splice(0).forEach(f=>f())}};
}
test('native scrolling is not intercepted and updates never scroll the page',()=>{
 const f=fixture();assert.equal(f.children.length,1);assert.equal(f.top.className,'page-scroll-top');assert.deepEqual(Object.keys(f.top.handlers),['click']);
 assert.equal(f.events.scroll.options.passive,true);
 for(const y of [210,800,400,0]){window.scrollY=y;f.events.scroll.callback();f.flush();assert.equal(window.scrollY,y)}
 assert.deepEqual(f.calls,[]);assert.equal(f.events.pointerdown,undefined);assert.equal(f.events.pointermove,undefined);
});
test('top button hides near top, on short pages, during login and in dialogs',()=>{
 const f=fixture();assert.equal(f.top.hidden,false);f.modal(true);f.events.scroll.callback();f.flush();assert.equal(f.top.hidden,true);
 f.modal(false);f.app.hidden=true;f.events.resize.callback();f.flush();assert.equal(f.top.hidden,true);
 f.app.hidden=false;document.documentElement.scrollHeight=810;f.events.resize.callback();f.flush();assert.equal(f.top.hidden,true);
});
test('back to top is the only scroll action and respects reduced motion',()=>{
 const f=fixture();f.top.handlers.click();assert.deepEqual(f.calls.at(-1),{top:0,behavior:'smooth'});
 window.matchMedia=()=>({matches:true});f.top.handlers.click();assert.deepEqual(f.calls.at(-1),{top:0,behavior:'instant'});
});
