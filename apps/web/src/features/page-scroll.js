// Scroll controls live outside the maps, so one-finger page scrolling stays available.
export function scrollProgress(top, height, viewport) {
 const max=Math.max(0,height-viewport);
 return {max,percent:max?Math.max(0,Math.min(100,top/max*100)):0};
}
export function initPageScroll(){
 const rail=document.createElement('div'),thumb=document.createElement('span'),top=document.createElement('button');
 rail.className='page-scroll-rail';rail.role='slider';rail.tabIndex=0;
 rail.setAttribute('aria-label','Rul på siden');rail.setAttribute('aria-orientation','vertical');rail.setAttribute('aria-valuemin','0');rail.setAttribute('aria-valuemax','100');
 thumb.className='page-scroll-thumb';rail.append(thumb);
 top.className='page-scroll-top';top.type='button';top.textContent='↑ Til toppen';
 rail.hidden=top.hidden=true;document.body.append(rail,top);
 const metrics=()=>scrollProgress(window.scrollY,document.documentElement.scrollHeight,window.innerHeight);
 let frame=0,dragging=false;
 function update(){frame=0;const m=metrics(),available=!document.querySelector('.app')?.hidden&&!document.querySelector('dialog[open]')&&m.max>40;
 rail.hidden=!available;top.hidden=!available||window.scrollY<200;
 rail.setAttribute('aria-valuenow',String(Math.round(m.percent)));rail.setAttribute('aria-valuetext',Math.round(m.percent)+' procent nede på siden');
 thumb.style.top=`calc(${m.percent}% - ${m.percent*.28}px)`;
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 function seek(event){const box=rail.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(event.clientY-box.top-14)/(box.height-28)));window.scrollTo({top:metrics().max*ratio,behavior:'instant'});schedule();}
 rail.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();dragging=true;rail.setPointerCapture(e.pointerId);seek(e);});
 rail.addEventListener('pointermove',e=>{if(dragging)seek(e);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])rail.addEventListener(name,()=>{dragging=false;});
 rail.addEventListener('keydown',e=>{const m=metrics(),keys={ArrowDown:window.scrollY+80,ArrowUp:window.scrollY-80,PageDown:window.scrollY+window.innerHeight*.8,PageUp:window.scrollY-window.innerHeight*.8,Home:0,End:m.max};if(!(e.key in keys))return;e.preventDefault();window.scrollTo({top:Math.max(0,Math.min(m.max,keys[e.key])),behavior:'instant'});schedule();});
 top.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
 new ResizeObserver(schedule).observe(document.body);
 const observer=new MutationObserver(schedule);
 observer.observe(document.querySelector('.app'),{attributes:true,attributeFilter:['hidden']});
 document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
 update();
}
