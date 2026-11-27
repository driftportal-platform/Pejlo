// Fixed CSS can follow a stale layout viewport on mobile Safari. Position the
// navigation against the visible viewport instead; document scroll is unrelated.
export function mobileNavigationTop({height,offsetTop=0,scale=1,navHeight}){
 if(![height,offsetTop,scale,navHeight].every(Number.isFinite)||height<=0||navHeight<=0||Math.abs(scale-1)>.01)return null;
 return Math.max(0,Math.round((Math.max(0,offsetTop)+height-navHeight)*100)/100);
}
export function createMobileNavigation({root=document,win=window}={}){
 const nav=root.querySelector('.sidebar');if(!nav)return null;
 const media=win.matchMedia('(max-width:700px)'),viewport=win.visualViewport;
 let frame=0,disposed=false;const timers=new Set(),listeners=[];
 function reset(){nav.style.removeProperty('--mobile-nav-top');nav.style.removeProperty('--mobile-nav-bottom');root.documentElement.style.removeProperty('--mobile-nav-height');}
 function update(){
  frame=0;if(disposed)return;
  if(!media.matches||!nav.getClientRects().length){reset();return;}
  const navHeight=nav.getBoundingClientRect().height;
  const top=mobileNavigationTop({height:viewport?.height??win.innerHeight,offsetTop:viewport?.offsetTop??0,scale:viewport?.scale??1,navHeight});
  if(top===null){reset();return;}
  nav.style.setProperty('--mobile-nav-top',top+'px');nav.style.setProperty('--mobile-nav-bottom','auto');
  root.documentElement.style.setProperty('--mobile-nav-height',Math.ceil(navHeight)+'px');
 }
 function schedule(){if(!disposed&&!frame)frame=win.requestAnimationFrame(update);}
 function settled(){schedule();for(const delay of [100,350]){const id=win.setTimeout(()=>{timers.delete(id);schedule();},delay);timers.add(id);}}
 function listen(target,event,handler=schedule){if(!target)return;target.addEventListener(event,handler,{passive:true});listeners.push([target,event,handler]);}
 for(const event of ['resize','scroll','scrollend']){listen(win,event);listen(viewport,event);}
 listen(win,'pageshow',settled);listen(win,'orientationchange',settled);listen(root,'focusout',settled);listen(root,'visibilitychange',settled);listen(media,'change');
 const observer=win.ResizeObserver?new win.ResizeObserver(schedule):null;observer?.observe(nav);schedule();
 return {update:schedule,destroy(){disposed=true;if(frame)win.cancelAnimationFrame(frame);for(const id of timers)win.clearTimeout(id);observer?.disconnect();for(const [target,event,handler] of listeners)target.removeEventListener(event,handler);reset();}};
}
