import {cleanProfile,defaultHome} from './profiles.js';
const KEY='pejlo-v03';
function read(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function untouchedLegacySample(p){return p.id==='loui-demo'&&p.name==='Loui'&&p.type==='cat'&&p.deviceLabel==='Q8_H · endnu ikke forbundet'&&p.home.lat===defaultHome.lat&&p.home.lon===defaultHome.lon&&p.home.radius===defaultHome.radius;}
export function loadState(){
  const current=read(KEY),legacy=current===null;
  const raw=legacy?read('find-loui-v02'):current;
  const ids=new Set();
  const profiles=Array.isArray(raw?.profiles)?raw.profiles.map(cleanProfile).filter(p=>p&&(!legacy||!untouchedLegacySample(p))&&!ids.has(p.id)&&ids.add(p.id)).slice(0,50):[];
  return {profiles,activeId:profiles.some(p=>p.id===raw?.activeId)?raw.activeId:profiles[0]?.id??null,mapKey:typeof raw?.mapKey==='string'?raw.mapKey.slice(0,200):''};
}
export function saveState(state){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}}
