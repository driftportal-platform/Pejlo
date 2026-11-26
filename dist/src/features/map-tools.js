const RETURN_TO_MAP=new Set(['center-loui','map-fence','map-trips','map-pause','fit-route','set-map-home']);
export function bindMapTools({button,dialog,closeButton}){
 const close=()=>{if(dialog.open)dialog.close();};
 button.setAttribute('aria-expanded','false');
 button.addEventListener('click',()=>{if(!dialog.open){dialog.showModal();button.setAttribute('aria-expanded','true');}});
 closeButton.addEventListener('click',close);
 dialog.addEventListener('close',()=>button.setAttribute('aria-expanded','false'));
 dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
 // Close before the existing action handler runs, including handlers opening
 // another dialog. Reusing the original nodes preserves state and permissions.
 dialog.addEventListener('click',event=>{if(RETURN_TO_MAP.has(event.target.closest?.('button')?.id))close();},true);
 return {close};
}
export function createMapTools(root=document,{section=()=>{}}={}){
 const page=root.querySelector('#kort'),map=page?.querySelector('.map-card'),actions=page?.querySelector('.map-actions'),bottom=page?.querySelector('.map-bottom'),options=page?.querySelector('.map-options'),follow=page?.querySelector('#follow-tracker')?.closest('label');
 if(![page,map,actions,bottom,options,follow].every(Boolean))return null;
 const doc=page.ownerDocument,button=doc.createElement('button');button.type='button';button.className='map-tools-open';button.id='map-tools-open';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','map-tools');
 button.setAttribute('aria-label','Åbn kortmenu');button.title='Kortmenu';
 button.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Kortmenu</span>';
 const dialog=doc.createElement('dialog');dialog.id='map-tools';dialog.className='map-tools';dialog.setAttribute('aria-labelledby','map-tools-title');
 const head=doc.createElement('div');head.className='dialog-header';const title=doc.createElement('h2');title.id='map-tools-title';title.textContent='Kortmenu';
 const closeButton=doc.createElement('button');closeButton.type='button';closeButton.className='icon-button';closeButton.textContent='×';closeButton.setAttribute('aria-label','Luk kortmenu');head.append(title,closeButton);
 const toolsTitle=doc.createElement('h3');toolsTitle.textContent='Rute og position';
 const viewTitle=doc.createElement('h3');viewTitle.textContent='Visning på kortet';
 options.open=true;
 const layer=map.querySelector('.layer-label'),more=doc.createElement('div');more.className='map-tools-sections';
 for(const [key,label] of [['omraade','Hjemmeområde og status'],['oplysninger','Trackeroplysninger']]){const b=doc.createElement('button');b.type='button';b.className='outline-button';b.textContent=label;b.addEventListener('click',()=>{dialog.close();section(key);});more.append(b);}
 dialog.append(head,actions,toolsTitle,bottom,viewTitle);if(layer)dialog.append(layer);dialog.append(follow,options,more);doc.body.append(dialog);(map.querySelector('.map-top')||map).append(button);
 return bindMapTools({button,dialog,closeButton});
}
