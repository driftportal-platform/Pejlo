// Keep drag geometry stable and commit at most one scroll per animation frame.
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
 const clamp=(n,max)=>Math.max(0,Math.min(max,n));
 let frame=0,drag=null,pending=null,travel=0;
 function update(){
  frame=0;
  const available=!document.querySelector('.app')?.hidden&&!document.querySelector('dialog[open]');
  if(!available){drag=null;pending=null;}
  if(pending!==null){const target=pending;pending=null;window.scrollTo({top:target,behavior:'instant'});}
  const m=drag?scrollProgress(window.scrollY,drag.max+window.innerHeight,window.innerHeight):metrics();rail.hidden=!available||m.max<=40;top.hidden=!available||window.scrollY<200;
  if(!rail.hidden){travel=drag?.travel??Math.max(0,rail.getBoundingClientRect().height-28);thumb.style.transform=`translate3d(0,${travel*m.percent/100}px,0)`;}
  const percent=String(Math.round(m.percent));
  if(rail.getAttribute('aria-valuenow')!==percent){rail.setAttribute('aria-valuenow',percent);rail.setAttribute('aria-valuetext',percent+' procent nede på siden');}
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 function seek(y){if(!drag)return;pending=drag.max*(drag.travel?clamp(y-drag.top-drag.offset,drag.travel)/drag.travel:0);schedule();}
 rail.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.preventDefault();
  const box=rail.getBoundingClientRect(),m=metrics(),range=Math.max(0,box.height-28),thumbTop=box.top+range*m.percent/100;
  const onThumb=e.clientY>=thumbTop&&e.clientY<=thumbTop+28;
  drag={id:e.pointerId,top:box.top,travel:range,max:m.max,offset:onThumb?e.clientY-thumbTop:14};
  rail.setPointerCapture(e.pointerId);
  // Grabbing the thumb keeps the page at its current position.
  if(!onThumb)seek(e.clientY);
 });
 rail.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id)seek(e.clientY);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])rail.addEventListener(name,e=>{if(drag&&e.pointerId===drag.id){drag=null;schedule();}});
 rail.addEventListener('keydown',e=>{const m=metrics(),keys={ArrowDown:window.scrollY+80,ArrowUp:window.scrollY-80,PageDown:window.scrollY+window.innerHeight*.8,PageUp:window.scrollY-window.innerHeight*.8,Home:0,End:m.max};if(!(e.key in keys))return;e.preventDefault();pending=clamp(keys[e.key],m.max);schedule();});
 top.addEventListener('click',()=>{pending=null;drag=null;window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
 new ResizeObserver(schedule).observe(document.body);
 const observer=new MutationObserver(schedule);
 observer.observe(document.querySelector('.app'),{attributes:true,attributeFilter:['hidden']});
 document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
 update();
}
