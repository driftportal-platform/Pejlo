import {routeAnalysis} from '../shared/history.js';
import {icon} from '../components/icons.js';
import {distance,searchZoom} from '../shared/geo.js';
import {types} from './profiles.js';
export const layers = {demo:'Skematisk eksempel',streets:'Gadekort',satellite:'Satellit / luftfoto',outdoor:'Terræn og stier'};
const mapIds = {streets:'streets-v4',satellite:'satellite',outdoor:'outdoor-v2'};
export function createMap(id, {notice, onHome, onManual} = {}) {
  const root = document.getElementById(id);
  if (!window.L) {root.textContent='Kortet kunne ikke indlæses.';return null;}
  const map=L.map(root,{zoomControl:false,maxZoom:20}).setView([56.55,8.314],16);
  L.control.zoom({position:'bottomright'}).addTo(map);
  let base, generation=0, errors=0;
  const markers=L.layerGroup().addTo(map), path=L.layerGroup().addTo(map), homeLayer=L.layerGroup().addTo(map), phone=L.layerGroup().addTo(map), draft=L.layerGroup().addTo(map);
  const markerIcon=(type,cls='')=>L.divIcon({html:`<div class="map-marker ${cls}">${icon(type,24)}</div>`,className:'',iconSize:[42,42],iconAnchor:[21,21]});
  function demo() {if(base)map.removeLayer(base);base=L.imageOverlay('./src/assets/images/demo-map.svg',[[56.544,8.300],[56.557,8.329]]).addTo(map);}
  demo();
  map.on('click',e=>onHome?.({lat:e.latlng.lat,lon:e.latlng.lng}));map.on('dragstart',()=>onManual?.());
  return {
    async layer(name,key='') {
      const current=++generation;
      if(name==='demo'){demo();return true;}
      if(!key){notice?.('De geografiske kort er endnu ikke aktiveret af Pejlo. Prøv igen senere.');return false;}
      try {
        const response=await fetch(`https://api.maptiler.com/maps/${mapIds[name]}/256/tiles.json?key=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw new Error();
        const json=await response.json();if(current!==generation)return false;
        const url=json.tiles?.[0];if(typeof url!=='string'||!url.startsWith('https://api.maptiler.com/'))throw new Error();
        if(base)map.removeLayer(base);errors=0;
        base=L.tileLayer(url,{maxZoom:20,maxNativeZoom:json.maxzoom||19,attribution:'© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',referrerPolicy:'strict-origin-when-cross-origin'}).addTo(map);
        base.on('tileerror',()=>{if(++errors===3)notice?.('Kortfliser kunne ikke hentes. Kontrollér internetforbindelsen, eller prøv igen senere.');});
        return true;
      } catch {if(current===generation)notice?.('Kortlaget kunne ikke indlæses. Prøv igen senere. Det tidligere lag beholdes.');return false;}
    },
    profile(p,data,{showRoute=true,showHome=true,history=false}={}) {
      markers.clearLayers();path.clearLayers();homeLayer.clearLayers();
      if(data.position){const label=document.createElement('span');label.textContent=p.name;L.marker([data.position.lat,data.position.lon],{icon:markerIcon(types[p.type].icon),title:p.name+(history?' · historisk punkt':data.source==='traccar'?' · seneste position':' · eksempelposition')}).addTo(markers).bindTooltip(label,{direction:'top'});}
      if(showRoute)for(const segment of routeAnalysis(data.route).segments)L.polyline(segment.map(p=>[p.lat,p.lon]),{color:'#51744e',weight:4,dashArray:'6 7'}).addTo(path);
      if(showHome&&p.homeConfirmed){L.marker([p.home.lat,p.home.lon],{icon:markerIcon('home','home-marker'),title:'Fast udgangspunkt'}).addTo(homeLayer);(p.home.shape==='polygon'?L.polygon(p.home.points.map(v=>[v.lat,v.lon]),{color:'#8ba16f',weight:2,fillOpacity:.13}):L.circle([p.home.lat,p.home.lon],{radius:p.home.radius,color:'#8ba16f',weight:1,fillOpacity:.13})).addTo(homeLayer);}
    },
    fit(p,data) {if(!p||!data)return;map.invalidateSize();map.fitBounds(L.latLngBounds([...data.route.map(p=>[p.lat,p.lon]),...(data.position?[[data.position.lat,data.position.lon]]:[]),[p.home.lat,p.home.lon],...(p.homeConfirmed&&p.home.shape==='polygon'?p.home.points.map(v=>[v.lat,v.lon]):[])]),{padding:[45,65],maxZoom:17});},
    search(user,target,auto) {
      phone.clearLayers();if(!user)return;
      L.circleMarker([user.lat,user.lon],{radius:7,color:'white',weight:3,fillColor:'#477fc1',fillOpacity:1}).addTo(phone);
      L.circle([user.lat,user.lon],{radius:user.accuracy,color:'#477fc1',weight:1,fillOpacity:.07}).addTo(phone);
      L.polyline([[user.lat,user.lon],[target.lat,target.lon]],{color:'#477fc1',dashArray:'4 8',weight:2}).addTo(phone);
      if(auto){map.invalidateSize();map.fitBounds(L.latLngBounds([[user.lat,user.lon],[target.lat,target.lon]]).pad(.25),{padding:[45,55],maxZoom:searchZoom(distance(user,target),user.accuracy),animate:false});}
    },
    clear(){draft.clearLayers();markers.clearLayers();path.clearLayers();homeLayer.clearLayers();phone.clearLayers();},
    draft(points){draft.clearLayers();if(points.length){L.polyline(points.map(v=>[v.lat,v.lon]),{color:'#a4564b',weight:3}).addTo(draft);points.forEach((v,i)=>L.circleMarker([v.lat,v.lon],{radius:7,color:'#a4564b'}).addTo(draft).bindTooltip(String(i+1)));if(points.length>=3)L.polygon(points.map(v=>[v.lat,v.lon]),{color:'#a4564b',fillOpacity:.1}).addTo(draft);}},
    clearPhone(){phone.clearLayers();},
    invalidate(){map.invalidateSize();}
  };
}
