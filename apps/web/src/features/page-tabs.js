// Keep the original elements and their event handlers; only change visibility.
export function createSectionTabs(page,groups,items,{changed=()=>{},available=()=>true}={}){
 const doc=page.ownerDocument,bar=doc.createElement('div'),buttons=new Map();
 bar.className='settings-tabs page-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label',page.id==='kort'?'Kortvisninger':'Ture og historik');
 let selected=groups[0][0];
 function select(key,notify=true){
  if(!buttons.has(key)||!available(key))return;
  const previous=selected;selected=key;
  for(const [element,keys] of items)element.classList.toggle('tab-hidden',!keys.includes(key));
  for(const [k,b] of buttons){b.hidden=!available(k);b.setAttribute('aria-selected',String(k===key));b.tabIndex=k===key?0:-1;}
  if(notify||previous!==key)for(const [element,keys] of items)if(element.tagName==='DETAILS'&&keys.includes(key)&&element.dataset.tabExpand==='true')element.open=true;
  if(notify&&previous!==key)changed(key,previous);
 }
 for(const [key,label] of groups){const b=doc.createElement('button');b.type='button';b.setAttribute('role','tab');b.textContent=label;b.addEventListener('click',()=>select(key));buttons.set(key,b);bar.append(b);}
 bar.addEventListener('keydown',e=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
  const keys=[...buttons.keys()].filter(available),index=keys.indexOf(selected);
  const next=e.key==='Home'?keys[0]:e.key==='End'?keys.at(-1):keys[(index+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length];
  e.preventDefault();select(next);buttons.get(next).focus();
 });
 page.prepend(bar);select(selected,false);
 return {select,sync(){select(available(selected)?selected:groups.find(([k])=>available(k))[0],false);},reset(){select(groups[0][0]);}};
}
export function initPageTabs(root=document,{mapChanged=()=>{},tripsChanged=()=>{}}={}){
 const map=root.querySelector('#kort'),trips=root.querySelector('#ture'),activity=root.querySelector('#activity');
 if(!map||!trips||!activity)return;
 const area=map.querySelector('.geofence-summary'),info=map.querySelector('.overview'),route=trips.querySelector('#route-history'),alarms=trips.querySelector('#alarms-reload')?.closest('details');
 const graphs=activity.querySelector('[data-activity-graphs]'),entry=activity.querySelector('[data-activity-entry-details]'),goal=activity.querySelector('[data-activity-goal-form]')?.closest('details'),days=activity.querySelector('[data-activity-rows]')?.closest('details');
 if(![area,info,route,alarms,graphs,entry,goal,days].every(Boolean))return;
 const mapItems=[...map.children].map(e=>[e,[e===area?'omraade':e===info?'oplysninger':'kort']]);
 const mapTabs=createSectionTabs(map,[['kort','Kort'],['omraade','Hjemmeområde'],['oplysninger','Oplysninger']],mapItems,{changed:mapChanged});
 const tripItems=[[activity,['overblik','grafer','dagstal']],[route,['ruter']],[alarms,['alarmer']]];
 for(const e of activity.children){
  let keys=['overblik'];
  if(e===graphs)keys=['grafer'];
  else if([entry,goal,days].includes(e))keys=['dagstal'];
  else if(e.matches('[data-activity-status],[data-activity-summary],h2,.eyebrow'))keys=['overblik','grafer','dagstal'];
  tripItems.push([e,keys]);
 }
 for(const e of [graphs,entry,days,route,alarms])e.dataset.tabExpand='true';
 const tripTabs=createSectionTabs(trips,[['overblik','Overblik'],['grafer','Grafer'],['dagstal','Dagstal'],['ruter','Rutehistorik'],['alarmer','Alarmer']],tripItems,{changed:tripsChanged,available:key=>!activity.hidden||['ruter','alarmer'].includes(key)});
 let wasHidden=activity.hidden;
 const observer=new MutationObserver(()=>{if(wasHidden&&!activity.hidden)tripTabs.select('overblik');else tripTabs.sync();wasHidden=activity.hidden;});observer.observe(activity,{attributes:true,attributeFilter:['hidden']});tripTabs.sync();
 activity.addEventListener('pejlo-edit-day',()=>tripTabs.select('dagstal'));
 return {map:mapTabs,trips:tripTabs,sync(){mapTabs.sync();tripTabs.sync();},reset(){mapTabs.reset();tripTabs.reset();}};
}
