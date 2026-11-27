import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mobileNavigationTop,createMobileNavigation} from '../apps/web/src/features/mobile-navigation.js';

test('mobile footer follows visible height, keyboard offsets and restoration without document scroll',()=>{
 assert.equal(mobileNavigationTop({height:800,navHeight:80}),720);
 assert.equal(mobileNavigationTop({height:700,navHeight:80}),620);
 assert.equal(mobileNavigationTop({height:450,offsetTop:120,navHeight:80}),490);
 assert.equal(mobileNavigationTop({height:800,offsetTop:0,navHeight:80}),720);
 assert.equal(mobileNavigationTop({height:390,navHeight:70}),320);
 for(const input of [{height:0,navHeight:80},{height:800,navHeight:0},{height:800,navHeight:80,scale:2},{height:NaN,navHeight:80}])assert.equal(mobileNavigationTop(input),null);
});

test('navigation updates after scrolling and viewport resize, releases desktop styles and cleans listeners',()=>{
 const emitter=()=>{const events=new Map();return {events,addEventListener(name,fn){events.set(name,fn);},removeEventListener(name){events.delete(name);},fire(name){events.get(name)?.();}};};
 const style=()=>({values:new Map(),setProperty(k,v){this.values.set(k,v);},removeProperty(k){this.values.delete(k);}});
 const nav={style:style(),getClientRects:()=>[{}],getBoundingClientRect:()=>({height:80})};
 const root={...emitter(),querySelector:()=>nav,documentElement:{style:style()}};
 const media={...emitter(),matches:true},viewport={...emitter(),height:800,offsetTop:0,scale:1};
 let frame,disconnected=false;const timeouts=new Map();
 const win={...emitter(),visualViewport:viewport,matchMedia:()=>media,requestAnimationFrame(fn){frame=fn;return 1;},cancelAnimationFrame(){frame=null;},setTimeout(fn,delay){timeouts.set(delay,fn);return delay;},clearTimeout(id){timeouts.delete(id);},ResizeObserver:class{observe(){}disconnect(){disconnected=true;}}};
 const flush=()=>{const fn=frame;frame=null;fn?.();};
 const ui=createMobileNavigation({root,win});flush();assert.equal(nav.style.values.get('--mobile-nav-top'),'720px');
 win.scrollY=1800;win.fire('scroll');flush();assert.equal(nav.style.values.get('--mobile-nav-top'),'720px');
 viewport.height=450;viewport.offsetTop=120;viewport.fire('resize');flush();assert.equal(nav.style.values.get('--mobile-nav-top'),'490px');
 viewport.height=800;viewport.offsetTop=0;root.fire('focusout');flush();assert.equal(nav.style.values.get('--mobile-nav-top'),'720px');assert.equal(timeouts.size,2);
 media.matches=false;media.fire('change');flush();assert.equal(nav.style.values.size,0);assert.equal(root.documentElement.style.values.size,0);
 ui.destroy();assert.equal(viewport.events.size,0);assert.equal(win.events.size,0);assert.equal(root.events.size,0);assert.equal(timeouts.size,0);assert.equal(disconnected,true);
});
