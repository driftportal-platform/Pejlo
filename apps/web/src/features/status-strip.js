// One glanceable line under the profile bar, composed from values the page already shows.
export function initStatusStrip(){
 const bar=document.querySelector('.profile-bar'),summary=document.querySelector('.geofence-summary');if(!bar||!summary)return;
 const strip=document.createElement('div');strip.id='status-strip';strip.className='status-strip';strip.setAttribute('role','status');strip.hidden=true;
 const dot=document.createElement('span');dot.className='status-dot';dot.setAttribute('aria-hidden','true');const text=document.createElement('span');strip.append(dot,text);bar.after(strip);
 const read=id=>document.getElementById(id)?.textContent.trim()||'';
 
 const update=()=>{
  const profile=document.getElementById('profile-open')?.textContent.replace('⌄','').trim(),age=read('age'),battery=read('battery-value');
  const kind=summary.dataset.state;strip.dataset.state=['inside','outside'].includes(kind)?kind:'unknown';
  const parts=[profile,read('home-observation'),age&&age!=='—'&&age!=='Ingen position'?age:'',battery&&!/^(—|Ikke oplyst)$/.test(battery)?'batteri '+battery:''].filter(Boolean);
  text.textContent=parts.join(' · ');strip.hidden=!profile||profile==='Ingen profiler endnu';
 };
 const watch=new MutationObserver(update);
 for(const id of ['age','battery-value','geofence-status','home-observation','profile-open'])watch.observe(document.getElementById(id)||document.body,{childList:true,characterData:true,subtree:true});
 watch.observe(summary,{attributes:true,attributeFilter:['data-state']});update();
}
