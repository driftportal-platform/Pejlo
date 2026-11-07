// Use native page scrolling. Only the explicit back-to-top button scrolls in code.
export function initPageScroll(){
 const top=document.createElement('button');
 top.className='page-scroll-top';top.type='button';top.textContent='↑ Til toppen';top.hidden=true;
 document.body.append(top);
 let frame=0;
 function update(){
  frame=0;
  const available=!document.querySelector('.app')?.hidden&&!document.querySelector('dialog[open]');
  top.hidden=!available||window.scrollY<200||document.documentElement.scrollHeight-window.innerHeight<=40;
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 top.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
 new ResizeObserver(schedule).observe(document.body);
 const observer=new MutationObserver(schedule);
 observer.observe(document.querySelector('.app'),{attributes:true,attributeFilter:['hidden']});
 document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
 update();
}
