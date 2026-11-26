export function availableMapHeight({viewportHeight,documentTop,navigationTop,scrollY=0,min=160}){
 if(![viewportHeight,documentTop,scrollY].every(Number.isFinite)||viewportHeight<=0)return null;
 // Layout top is stable while scrolling; never grow the map as it is scrolled.
 const bottom=Number.isFinite(navigationTop)?Math.min(viewportHeight,navigationTop):viewportHeight;
 return Math.max(min,Math.min(720,Math.floor(bottom-documentTop-10)));
}
export function createMapViewport({root=document,win=window,resized=()=>{}}={}){
 const card=root.querySelector('#kort .map-card'),page=root.querySelector('#kort'),nav=root.querySelector('.sidebar');if(!card||!page)return null;
 let frame=0,last=null;
 function update(){
  frame=0;if(!win.matchMedia('(max-width:700px)').matches||!card.getClientRects().length)return;
  if(win.visualViewport?.scale&&Math.abs(win.visualViewport.scale-1)>.01)return;
  if(root.activeElement?.matches?.('input:not([type=checkbox]):not([type=range]),textarea,[contenteditable=true]'))return;
  const viewportHeight=win.visualViewport?.height||win.innerHeight,scrollY=win.scrollY||0;
  const navigationTop=nav&&win.getComputedStyle(nav).position==='fixed'?nav.getBoundingClientRect().top:undefined;
  const height=availableMapHeight({viewportHeight,documentTop:card.getBoundingClientRect().top+scrollY,navigationTop,scrollY});
  if(height===null||height===last)return;last=height;card.style.setProperty('--overview-map-height',height+'px');resized();
 }
 const schedule=()=>{if(!frame)frame=win.requestAnimationFrame(update);};
 const observer=new ResizeObserver(schedule);
 for(const e of [page,nav,root.querySelector('.account-toolbar'),root.querySelector('.profile-bar'),root.querySelector('.status-bar')])if(e)observer.observe(e);
 win.addEventListener('resize',schedule);win.visualViewport?.addEventListener('resize',schedule);schedule();
 return {update:schedule};
}
