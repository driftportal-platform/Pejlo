import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scrollProgress,initPageScroll} from '../apps/web/src/features/page-scroll.js';
test('scroll range handles short pages and Safari overscroll',()=>{
 assert.deepEqual(scrollProgress(0,600,800),{max:0,percent:0});
 assert.equal(scrollProgress(-70,1800,800).percent,0);
 assert.equal(scrollProgress(1200,1800,800).percent,100);
});
function fixture(){
 const children=[],events={},frames=[],calls=[];let modal=false,app={hidden:false},reads=0;
 const el=()=>({hidden:false,style:{},attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},append(){},addEventListener(k,v){this.handlers[k]=v},getBoundingClientRect(){reads++;return{top:100,height:228}},setPointerCapture(){}});
 globalThis.document={createElement:el,body:{append(...nodes){children.push(...nodes)}},documentElement:{scrollHeight:2000},querySelector:s=>s==='.app'?app:modal?{}:null,querySelectorAll:()=>[]};
 globalThis.window={scrollY:600,innerHeight:800,scrollTo:o=>{calls.push(o);window.scrollY=o.top},matchMedia:()=>({matches:true}),addEventListener:(k,v)=>events[k]=v};
 globalThis.ResizeObserver=class{observe(){}};globalThis.MutationObserver=class{observe(){}};globalThis.requestAnimationFrame=f=>{frames.push(f);return frames.length};
 initPageScroll();return{rail:children[0],top:children[1],calls,frames,events,app,reads:()=>reads,modal:v=>modal=v,flush(){const batch=frames.splice(0);batch.forEach(f=>f())}};
}
test('scroll controls handle keyboard navigation, dragging, dialogs and reduced motion',()=>{
 const f=fixture(),{rail,top}=f;
 assert.equal(rail.hidden,false);assert.equal(top.hidden,false);assert.equal(rail.attrs['aria-valuenow'],'50');
 rail.handlers.keydown({key:'End',preventDefault(){}});f.flush();assert.equal(f.calls.at(-1).top,1200);
 rail.handlers.pointerdown({button:0,pointerId:1,clientY:114,preventDefault(){}});f.flush();assert.equal(f.calls.at(-1).top,0);
 rail.handlers.pointermove({pointerId:1,clientY:314});f.flush();assert.equal(f.calls.at(-1).top,1200);rail.handlers.pointerup({pointerId:1});f.flush();
 rail.handlers.pointermove({pointerId:1,clientY:114});f.flush();assert.equal(f.calls.at(-1).top,1200);
 top.handlers.click();assert.deepEqual(f.calls.at(-1),{top:0,behavior:'instant'});
 f.modal(true);f.events.scroll();f.flush();assert.equal(rail.hidden,true);assert.equal(top.hidden,true);
 f.modal(false);f.app.hidden=true;f.events.scroll();f.flush();assert.equal(rail.hidden,true);
});
test('thumb grabs do not jump and rapid moves produce one scroll using frozen geometry',()=>{
 const f=fixture(),{rail}=f;
 // Thumb spans y=200..228 at 50%; grab its lower edge instead of its centre.
 rail.handlers.pointerdown({button:0,pointerId:7,clientY:225,preventDefault(){}});f.flush();assert.equal(f.calls.length,0);
 const reads=f.reads();
 rail.handlers.pointermove({pointerId:7,clientY:225});rail.handlers.pointermove({pointerId:7,clientY:230});rail.handlers.pointermove({pointerId:7,clientY:235});
 assert.equal(f.calls.length,0);assert.equal(f.frames.length,1);
 // A resize while dragging must not rescale the current gesture.
 document.documentElement.scrollHeight=3000;f.flush();
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].top,660);assert.equal(f.reads(),reads);
 rail.handlers.pointermove({pointerId:8,clientY:300});f.flush();assert.equal(f.calls.length,1);
 rail.handlers.pointerup({pointerId:7});f.flush();
});
