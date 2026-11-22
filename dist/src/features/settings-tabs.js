// Splits the long settings page into five short tabs. Falls back to showing everything if the page layout is unexpected.
const GROUPS=[['profil','Profil',[0]],['omraade','Område',[1]],['beskeder','Beskeder',[2,3]],['deling','Deling',[4]],['tracker','Tracker',[5]]];
export function initSettingsTabs(root=document){
 const grid=root.querySelector('#indstillinger .settings-grid');if(!grid)return;
 const panels=[...grid.querySelectorAll(':scope>article.panel')];if(panels.length!==6)return;
 for(const [key,,indexes] of GROUPS)for(const i of indexes)panels[i].dataset.group=key;
 const bar=document.createElement('div');
 bar.className='settings-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Indstillinger');
 const buttons=new Map();
 const select=key=>{if(!buttons.has(key))return;for(const p of panels)p.classList.toggle('tab-hidden',p.dataset.group!==key);for(const [k,b] of buttons){b.setAttribute('aria-selected',String(k===key));b.tabIndex=k===key?0:-1;}try{sessionStorage.setItem('pejlo-settings-tab',key);}catch{}};
 for(const [key,label] of GROUPS){const b=document.createElement('button');b.type='button';b.role='tab';b.textContent=label;b.addEventListener('click',()=>select(key));buttons.set(key,b);bar.append(b);}
 bar.addEventListener('keydown',event=>{const keys=[...buttons.keys()],now=keys.findIndex(k=>buttons.get(k).getAttribute('aria-selected')==='true');const next=event.key==='ArrowRight'?now+1:event.key==='ArrowLeft'?now-1:null;if(next===null)return;event.preventDefault();const key=keys[(next+keys.length)%keys.length];select(key);buttons.get(key).focus();});
 grid.before(bar);
 let start='profil';try{const saved=sessionStorage.getItem('pejlo-settings-tab');if(buttons.has(saved))start=saved;}catch{}
 select(start);return {select,reset:()=>select('profil')};
}
