import {validPolygon} from './fence.js';
import {validPoint} from './geo.js';
export const types = {
  cat: {label: 'Kat', icon: 'cat', category: 'dyr', noun: 'Hjemmeområde'},
  dog: {label: 'Hund', icon: 'dog', category: 'dyr', noun: 'Hjemmeområde'},
  horse: {label: 'Hest', icon: 'horse', category: 'dyr', noun: 'Fold / hjemmeområde'},
  animal: {label: 'Andet dyr', icon: 'paw', category: 'dyr', noun: 'Hjemmeområde'},
  car: {label: 'Bil', icon: 'car', category: 'genstand', noun: 'Fast holdeplads'},
  bicycle: {label: 'Cykel', icon: 'bicycle', category: 'genstand', noun: 'Fast parkeringssted'},
  object: {label: 'Anden genstand', icon: 'object', category: 'genstand', noun: 'Fast udgangspunkt'}
};
export const defaultHome = {lat:56.5495,lon:8.311,radius:100};
export function cleanHome(h){
 if(!validPoint(h)||!Number.isFinite(h.radius)||h.radius<20||h.radius>5000)return null;
 if(h.shape==='polygon'&&!validPolygon(h.points))return null;
 return {lat:h.lat,lon:h.lon,radius:h.radius,buffer:Number.isFinite(h.buffer)&&h.buffer>=0&&h.buffer<=30?h.buffer:5,shape:h.shape==='polygon'?'polygon':'circle',...(h.shape==='polygon'?{points:h.points.map(v=>({lat:v.lat,lon:v.lon}))}:{})};
}
export function cleanProfile(p) {
 if(!p||typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!Object.hasOwn(types,p.type))return null;
 const home=cleanHome(p.home);if(!home)return null;
 const presets=Array.isArray(p.fencePresets)?p.fencePresets.slice(0,20).flatMap(f=>{
  const h=cleanHome(f?.home);return h&&typeof f.id==='string'&&f.id&&typeof f.name==='string'&&f.name.trim()?[{id:f.id.slice(0,100),name:f.name.trim().slice(0,40),home:h}]:[];
 }):p.homeConfirmed?[{id:'original',name:'Hjemme',home:structuredClone(home)}]:[];
 const unique=presets.filter((f,i)=>presets.findIndex(x=>x.id===f.id)===i);
 const active=unique.find(f=>f.id===p.activeFenceId)||(!Array.isArray(p.fencePresets)?unique[0]:null);
 return {id:p.id.slice(0,100),name:p.name.trim(),type:p.type,deviceLabel:typeof p.deviceLabel==='string'?p.deviceLabel.slice(0,60):'',trackerId:typeof p.trackerId==='string'?p.trackerId.slice(0,100):'',geofenceEnabled:p.geofenceEnabled===true,homeConfirmed:p.homeConfirmed===true,home,fencePresets:unique,activeFenceId:active?.id||null};
}
export const createId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
export function newProfile(name,type,deviceLabel=''){
 return cleanProfile({id:createId(),name,type,deviceLabel,home:{...defaultHome}});
}
export const profileSubtitle = p => `${types[p.type].label} · ${types[p.type].category === 'dyr' ? 'Dyreprofil' : 'Genstandsprofil'}`;
