// Replaces the profile drop-down with a button that opens a sheet of profile cards.
// The original <select> stays in the page as the source of truth for the rest of the app.
export function createProfileSheet({select,add}){
 const wrap=select.closest('.profile-switch'),open=document.createElement('button');
 open.type='button';open.id='profile-open';open.className='profile-open';open.setAttribute('aria-haspopup','dialog');
 const label=document.createElement('span');label.className='profile-open-label';
 const chevron=document.createElement('span');chevron.className='profile-open-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';
 open.append(label,chevron);select.classList.add('visually-hidden');select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.after(open);
 const dialog=document.createElement('dialog');dialog.className='sheet';dialog.setAttribute('aria-labelledby','profile-sheet-title');
 const head=document.createElement('div');head.className='sheet-head';
 const title=document.createElement('h2');title.id='profile-sheet-title';title.textContent='Vælg profil';
 const close=document.createElement('button');close.type='button';close.className='icon-button';close.setAttribute('aria-label','Luk');close.textContent='×';
 head.append(title,close);
 const list=document.createElement('div');list.className='sheet-list';
 const addButton=document.createElement('button');addButton.type='button';addButton.className='outline-button sheet-add';addButton.textContent='+ Tilføj profil';
 dialog.append(head,list,addButton);document.body.append(dialog);
 open.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 addButton.addEventListener('click',()=>{dialog.close();add.click();});
 return {update(profiles,activeId){
  if(!profiles.length&&dialog.open)dialog.close();
  const active=profiles.find(p=>p.id===activeId);
  label.textContent=active?active.name:'Ingen profiler endnu';
  list.replaceChildren(...profiles.map(p=>{
   const card=document.createElement('button');card.type='button';card.className='sheet-card';if(p.id===activeId)card.setAttribute('aria-current','true');
   const icon=document.createElement('span');icon.className='sheet-icon';if(p.photo){const img=document.createElement('img');img.src=p.photo;img.alt='';img.className='profile-photo-small';icon.append(img);}else icon.innerHTML=p.icon;
   const text=document.createElement('span'),name=document.createElement('b'),kind=document.createElement('small');name.textContent=p.name;kind.textContent=p.label;text.append(name,kind);
   const mark=document.createElement('span');mark.className='sheet-check';mark.textContent=p.id===activeId?'✓':'';card.append(icon,text,mark);
   card.addEventListener('click',()=>{dialog.close();if(p.id!==activeId){select.value=p.id;select.dispatchEvent(new Event('change',{bubbles:true}));}});
   return card;}));
 }};
}
