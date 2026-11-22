// Folds explanatory .hint paragraphs on the settings page behind a small "? Hjælp" button.
// Paragraphs with an id, a live-region role or child elements are left alone (the app writes to them).
export function collapseHints(root=document){
 let n=0;
 for(const p of root.querySelectorAll('#indstillinger p.hint')){
  if(p.id||p.getAttribute('role')||p.children.length||p.textContent.trim().length<25)continue;
  const button=document.createElement('button');button.type='button';button.className='hint-toggle';
  const mark=document.createElement('span'),text=document.createElement('span');mark.className='q';mark.setAttribute('aria-hidden','true');
  button.append(mark,text);p.id='hint-'+(++n);button.setAttribute('aria-controls',p.id);
  const set=open=>{p.hidden=!open;button.setAttribute('aria-expanded',String(open));mark.textContent=open?'×':'?';text.textContent=open?'Skjul hjælp':'Hjælp';};
  button.addEventListener('click',()=>set(p.hidden));set(false);p.before(button);
 }
 return n;
}
