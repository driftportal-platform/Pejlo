import {cleanProfile} from './profiles.js';
export const emptyState=()=>({profiles:[],activeId:null,mapKey:''});
export function normalizeAccountState(raw){
 const ids=new Set();const profiles=Array.isArray(raw?.profiles)?raw.profiles.map(cleanProfile).filter(p=>p&&!ids.has(p.id)&&ids.add(p.id)).slice(0,50):[];
 return {profiles,activeId:profiles.some(p=>p.id===raw?.activeId)?raw.activeId:profiles[0]?.id??null,mapKey:typeof raw?.mapKey==='string'?raw.mapKey.slice(0,200):''};
}
export function assertRevision(remote,expected){if((remote??0)!==expected){const e=new Error('Data er ændret på en anden enhed. Den nyeste udgave er hentet. Prøv ændringen igen.');e.code='pejlo/conflict';throw e;}}
