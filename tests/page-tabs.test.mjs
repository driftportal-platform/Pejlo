import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSectionTabs} from '../apps/web/src/features/page-tabs.js';
class Element{
 constructor(tag='section'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.listeners={};this.hidden=false;this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)};this.ownerDocument={createElement:tag=>new Element(tag)};}
 setAttribute(k,v){this.attributes[k]=v;}
 append(e){this.children.push(e);}
 prepend(e){this.children.unshift(e);}
 addEventListener(k,fn){this.listeners[k]=fn;}
 focus(){this.focused=true;}
}
function setup(){const page=new Element(),a=new Element(),b=new Element('details'),shared=new Element();b.dataset.tabExpand='true';a.hidden=true;let allowed=true;const changes=[];const tabs=createSectionTabs(page,[['map','Kort'],['route','Rute'],['alarm','Alarmer']],[[a,['map']],[b,['route']],[shared,['map','route']]],{changed:(...args)=>changes.push(args),available:k=>allowed||k==='alarm'});return {page,a,b,shared,tabs,changes,restrict:()=>allowed=false};}
test('section menus preserve native visibility and element identity, and notify map/playback on changes',()=>{
 const {page,a,b,shared,tabs,changes}=setup();assert.equal(a.hidden,true);assert.equal(a.classes.has('tab-hidden'),false);assert.equal(b.classes.has('tab-hidden'),true);
 tabs.select('route');assert.equal(a.classes.has('tab-hidden'),true);assert.equal(b.classes.has('tab-hidden'),false);assert.equal(shared.classes.has('tab-hidden'),false);assert.equal(b.open,true);assert.deepEqual(changes,[['route','map']]);
 b.open=false;tabs.sync();assert.equal(b.open,false,'background refresh does not reopen a collapsed section');assert.equal(changes.length,1);
 tabs.select('alarm');assert.equal(shared.classes.has('tab-hidden'),true);assert.equal(page.children[0].children.filter(e=>e.attributes['aria-selected']==='true').length,1);
});
test('keyboard navigation wraps, supports Home/End and skips unavailable animal tabs',()=>{
 const {page,tabs,restrict}=setup(),bar=page.children[0],selected=()=>bar.children.find(e=>e.attributes['aria-selected']==='true');
 const key=value=>bar.listeners.keydown({key:value,preventDefault(){}});
 key('ArrowLeft');assert.equal(selected().textContent,'Alarmer');assert.equal(selected().focused,true);key('Home');assert.equal(selected().textContent,'Kort');key('End');assert.equal(selected().textContent,'Alarmer');
 restrict();tabs.sync();assert.equal(bar.children[0].hidden,true);tabs.select('map');assert.equal(selected().textContent,'Alarmer');key('ArrowRight');assert.equal(selected().textContent,'Alarmer');assert.equal(selected().tabIndex,0);
});
