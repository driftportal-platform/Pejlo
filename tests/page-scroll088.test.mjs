import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scrollProgress,initPageScroll} from '../apps/web/src/features/page-scroll.js';
test('scroll range handles short pages and Safari overscroll',()=>{
 assert.deepEqual(scrollProgress(0,600,800),{max:0,percent:0});
 assert.equal(scrollProgress(-70,1800,800).percent,0);
 assert.equal(scrollProgress(1200,1800,800).percent,100);
});
test('scroll controls handle keyboard navigation, dragging, dialogs and reduced motion',()=>{
 const children=[],events={};let modal=false,app={hidden:false},last;
 const el=()=>({hidden:false,style:{},attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v},append(){},addEventListener(k,v){this.handlers[k]=v},getBoundingClientRect(){return{top:100,height:228}},setPointerCapture(){}});
 globalThis.document={createElement:el,body:{append(...nodes){children.push(...nodes)}},documentElement:{scrollHeight:2000},querySelector:s=>s==='.app'?app:modal?{}:null,querySelectorAll:()=>[]};
 globalThis.window={scrollY:600,innerHeight:800,scrollTo:o=>{last=o;window.scrollY=o.top},matchMedia:()=>({matches:true}),addEventListener:(k,v)=>events[k]=v};
 globalThis.ResizeObserver=class{observe(){}};globalThis.MutationObserver=class{observe(){}};globalThis.requestAnimationFrame=f=>{f();return 0};
 initPageScroll();const [rail,top]=children;
 assert.equal(rail.hidden,false);assert.equal(top.hidden,false);assert.equal(rail.attrs['aria-valuenow'],'50');
 rail.handlers.keydown({key:'End',preventDefault(){}});assert.equal(last.top,1200);
 rail.handlers.pointerdown({button:0,pointerId:1,clientY:114,preventDefault(){}});assert.equal(last.top,0);
 rail.handlers.pointermove({clientY:314});assert.equal(last.top,1200);rail.handlers.pointerup();
 rail.handlers.pointermove({clientY:114});assert.equal(last.top,1200);
 top.handlers.click();assert.deepEqual(last,{top:0,behavior:'instant'});
 modal=true;events.scroll();assert.equal(rail.hidden,true);assert.equal(top.hidden,true);
 modal=false;app.hidden=true;events.scroll();assert.equal(rail.hidden,true);
});
