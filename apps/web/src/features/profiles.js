import {validPolygon} from '../shared/fence.js';
import {validPoint} from '../shared/geo.js';
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
export function cleanProfile(p) {
  if (!p || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40 || !Object.hasOwn(types,p.type) || !validPoint(p.home) || !Number.isFinite(p.home.radius) || p.home.radius < 20 || p.home.radius > 5000) return null;
  return {id:p.id.slice(0,100), name:p.name.trim(), type:p.type, deviceLabel:typeof p.deviceLabel === 'string' ? p.deviceLabel.slice(0,60) : '', trackerId:typeof p.trackerId === 'string' ? p.trackerId.slice(0,100) : '', geofenceEnabled:p.geofenceEnabled===true, homeConfirmed:p.homeConfirmed===true, home:{lat:p.home.lat,lon:p.home.lon,radius:p.home.radius,shape:p.home.shape==='polygon'&&validPolygon(p.home.points)?'polygon':'circle',...(p.home.shape==='polygon'&&validPolygon(p.home.points)?{points:p.home.points.map(v=>({lat:v.lat,lon:v.lon}))}:{})}};
}
export function newProfile(name, type, deviceLabel = '') {
  return cleanProfile({id:(typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('')),name,type,deviceLabel,home:{...defaultHome}});
}
export const profileSubtitle = p => `${types[p.type].label} · ${types[p.type].category === 'dyr' ? 'Dyreprofil' : 'Genstandsprofil'}`;
