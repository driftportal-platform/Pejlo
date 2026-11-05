import {cleanProfile, defaultHome} from './profiles.js';
const KEY = 'find-loui-v02';
export function loadState() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (raw && Array.isArray(raw.profiles)) {
    const ids = new Set();
    const profiles = raw.profiles.map(cleanProfile).filter(p => p && !ids.has(p.id) && ids.add(p.id)).slice(0,50);
    if (profiles.length) return {profiles, activeId:profiles.some(p => p.id === raw.activeId) ? raw.activeId : profiles[0].id, mapKey:typeof raw.mapKey === 'string' ? raw.mapKey.slice(0,200) : ''};
  }
  let home = {...defaultHome};
  try { const old = JSON.parse(localStorage.getItem('find-loui-home')); if (cleanProfile({id:'x',name:'x',type:'cat',home:old})) home = old; } catch {}
  return {profiles:[{id:'loui-demo',name:'Loui',type:'cat',deviceLabel:'Q8_H · endnu ikke forbundet',home}],activeId:'loui-demo',mapKey:''};
}
export function saveState(state) { try {localStorage.setItem(KEY, JSON.stringify(state));return true;} catch {return false;} }
