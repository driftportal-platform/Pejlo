import {danishDate,routeAnalysis} from '../shared/history.js';
import {advanceFence} from '../shared/fence-events.js';
import {formatDistance} from '../shared/geo.js';
import {createMap} from './maps.js';
export function createHistoryView({request,selected,layer,key,notice}){
 const $=s=>document.querySelector(s);let value=null,map=null,timer=null,generation=0;
 const time=stamp=>new Date(stamp).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen'});
 const stop=()=>{clearInterval(timer);timer=null;$('#history-play').textContent='Afspil';};
 function clear(){generation++;stop();value=null;map?.clear();$('#timeline').replaceChildren();$('#history-summary').textContent='';$('#history-transitions').replaceChildren();$('#history-status').textContent='';$('#playback-time').textContent='';$('#history-slider').max=0;}
 function point(){if(!value)return;const p=value.analysis.points[+$('#history-slider').value];if(!p)return;map?.profile(value.profile,{source:'traccar',position:p,route:value.analysis.points},{showRoute:true,showHome:true,history:true});$('#playback-time').textContent=time(p.timestamp);}
 async function load(){
  stop();const p=selected();if(!p?.trackerId){clear();$('#history-status').textContent='Tilknyt en tracker for at hente historik.';return;}
  const gen=++generation,id=p.id;$('#history-status').textContent='Henter historik…';map?.clear();value=null;
  try{
   const data=await request('tracker?'+new URLSearchParams({identifier:p.trackerId,from:$('#history-from').value,to:$('#history-to').value}));
   if(gen!==generation||selected()?.id!==id)return;
   if(!data.historyAvailable)throw Error('Historikken kunne ikke hentes. Prøv igen.');
   const analysis=routeAnalysis(data.route);value={profile:structuredClone(p),analysis};
   if(!map)map=createMap('history-map',{notice});await map?.layer(layer(),key());if(gen!==generation)return;
   map?.profile(p,{...data,route:analysis.points,position:null},{showRoute:true,showHome:true,history:true});map?.fit(p,{...data,route:analysis.points,position:null});
   $('#history-status').textContent=analysis.points.length?'Perioden er hentet i dansk tid.':'Ingen GPS-punkter i perioden. Testserverens historik kan være begrænset.';
   $('#history-summary').textContent=analysis.points.length+' punkter · '+formatDistance(analysis.meters)+' anslået · '+analysis.gaps.length+' huller over 10 minutter · '+(analysis.rejected+(data.gpsRejected||0))+' punkter frasorteret'+(data.historyTruncated?' · Kun de seneste 10.000 punkter vises.':'');
   $('#history-slider').max=Math.max(0,analysis.points.length-1);$('#history-slider').value=0;
   $('#timeline').replaceChildren();
   for(const gap of analysis.gaps){const el=document.createElement('p');el.className='history-gap';el.textContent='Manglende spor: '+time(gap.from)+' – '+time(gap.to);$('#timeline').append(el);}
   $('#history-transitions').replaceChildren();
   const text=document.createElement('p');text.className='hint';text.textContent='Passager er anslået ud fra det nu valgte område og de tilgængelige punkter. Området kan have været anderledes dengang. Afspilningen springer huller over. GPS-udsving under 5 m tælles ikke i afstanden; større drift kan stadig tælle med.';$('#history-transitions').append(text);
   if(p.homeConfirmed){let state={},previous=null;for(const pt of analysis.points){if(previous&&pt.timestamp-previous>600000)state={};previous=pt.timestamp;const r=advanceFence(p.home,{valid:true,latitude:pt.lat,longitude:pt.lon,fixTime:new Date(pt.timestamp).toISOString()},state,pt.timestamp);state=r.state;if(r.transition){const el=document.createElement('p');el.textContent=time(pt.timestamp)+' · '+(r.transition==='exit'?'Forlod området':'Tilbage i området');$('#history-transitions').append(el);}}}
   point();
  }catch(error){if(gen===generation){value=null;$('#history-status').textContent=error.message;$('#history-summary').textContent='';$('#history-transitions').replaceChildren();$('#timeline').replaceChildren();}}
 }
 $('#history-from').value=$('#history-to').value=danishDate();$('#history-from').max=$('#history-to').max=danishDate();
 $('#history-form').onsubmit=e=>{e.preventDefault();load();};
 $('#history-today').onclick=()=>{$('#history-from').value=$('#history-to').value=danishDate();load();};
 $('#history-yesterday').onclick=()=>{const day=new Date(Date.parse(danishDate())-86400000).toISOString().slice(0,10);$('#history-from').value=$('#history-to').value=day;load();};
 $('#history-slider').oninput=()=>{stop();point();};
 $('#history-play').onclick=()=>{if(timer){stop();return;}if(!value?.analysis.points.length)return notice('Hent først en periode med GPS-punkter.');if(+$('#history-slider').value>=+$('#history-slider').max)$('#history-slider').value=0;$('#history-play').textContent='Pause';timer=setInterval(()=>{const n=+$('#history-slider').value+1;if(n>+$('#history-slider').max){stop();return;}$('#history-slider').value=n;point();},500);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 return {load,clear,stop};
}
