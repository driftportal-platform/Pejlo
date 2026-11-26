import {wifiObservation,wifiObservations,normalizeMac} from '../shared/home-wifi.js';

// Keep unconfirmed neighbours in memory only. Repeated API polls are not new scans.
export function createWifiScan(){
 const points=new Map();let lastAt=null,scans=0;
 return {
  observe(data,now=Date.now()){
   let changed=false;
   for(const o of wifiObservations(data,{},now)){
   if(!o.fresh||!o.all.length||lastAt!==null&&o.at<=lastAt)continue;
   changed=true;
   lastAt=o.at;scans++;
   for(const p of o.all){
    const previous=points.get(p.mac);
    if(!previous&&points.size>=64)continue;
    points.set(p.mac,{mac:p.mac,rssi:p.rssi,strongest:Math.max(previous?.strongest??-100,p.rssi),seen:(previous?.seen??0)+1,lastAt:o.at});
   }
   }
   return changed;
  },
  snapshot:()=>({scans,lastAt,points:[...points.values()].map(p=>({...p})).sort((a,b)=>b.strongest-a.strongest)})
 };
}

export function mergeWifiSelection(current,chosen){
 const values=[...current,...chosen].map(normalizeMac);
 if(values.some(v=>!v))throw Error('Kontrollér de indtastede Wi-Fi-adresser først.');
 const macs=[...new Set(values)];
 if(!chosen.length)throw Error('Vælg mindst ét Wi-Fi-punkt, som tilhører dit hjem.');
 if(macs.length>16)throw Error('Du kan gemme højst 16 Wi-Fi-punkter. Vælg færre punkter.');
 return macs;
}

export function createWifiDiscovery({root,selected,data,canEdit,ready,readMacs,onUse,notice,now=Date.now}){
 const q=s=>root.querySelector(s),start=q('[data-wifi-start]'),stop=q('[data-wifi-stop]'),use=q('[data-wifi-use]'),status=q('[data-wifi-status]'),list=q('[data-wifi-list]');
 const doc=root.ownerDocument,rows=new Map();let key=null,scan=createWifiScan(),running=false,chosen=new Set(),used=false,saved=false;
 function clear(){key=null;scan=createWifiScan();running=false;chosen.clear();rows.clear();list.replaceChildren();used=false;saved=false;}
 function context(){const p=selected();return p?.trackerId?JSON.stringify([p.id,p.trackerId]):null;}
 function render(){
  const nextKey=context();if(nextKey!==key){clear();key=nextKey;}
  const editable=!!key&&canEdit(),available=editable&&ready();
  if(!available)running=false;
  if(running)scan.observe(data(),now());
  const snapshot=scan.snapshot(),o=wifiObservation(data(),{},now());
  start.disabled=!available||running;start.textContent=snapshot.scans?'Start ny indsamling':'Se Wi-Fi fra trackeren';
  stop.hidden=!running;use.hidden=!snapshot.points.length;
  for(const p of snapshot.points){
   let row=rows.get(p.mac);
   if(!row){
    const label=doc.createElement('label'),checkbox=doc.createElement('input'),text=doc.createElement('span'),title=doc.createElement('strong'),detail=doc.createElement('small');
    checkbox.type='checkbox';checkbox.checked=chosen.has(p.mac);title.textContent=p.mac;text.append(title,detail);label.append(checkbox,text);label.className='wifi-candidate';list.append(label);
    row={checkbox,detail};rows.set(p.mac,row);
    checkbox.addEventListener('change',()=>{if(checkbox.checked)chosen.add(p.mac);else chosen.delete(p.mac);used=false;saved=false;render();});
   }
   row.checkbox.disabled=!available;
   const age=Math.max(0,Math.floor((now()-p.lastAt)/1000));
   row.detail.textContent=p.rssi+' dBm · stærkest '+p.strongest+' dBm · set i '+p.seen+' måling'+(p.seen===1?'':'er')+' · senest '+age+' sek. siden';
  }
  use.disabled=!available||![...chosen].some(mac=>rows.has(mac));
  if(!key)status.textContent='Forbind og gem en tracker på profilen først.';
  else if(!editable)status.textContent='Du har kun læseadgang til denne profil.';
  else if(!ready())status.textContent='Gem dit valg af tracker på profilen før søgning.';
  else if(used)status.textContent='De valgte punkter er tilføjet til feltet nedenfor. Tryk Gem profil for at gemme dem.';
  else if(saved)status.textContent='Hjemmets Wi-Fi er gemt på profilen. Du kan nu gemme målinger inde og ude nedenfor.';
  else if(!running)status.textContent=snapshot.scans?'Søgning stoppet. '+snapshot.points.length+' punkter fundet i '+snapshot.scans+' målinger. Vælg dine egne punkter.':'Start indsamlingen, og flyt trackeren til forskellige steder i huset. Appen læser trackerens rapporter; den sender ikke en scanningskommando.';
  else if(data()?.device?.status!=='online')status.textContent='Søgning startet. Afventer, at trackeren kommer online. Fundne punkter bevares.';
  else if(!o.fresh||!o.all.length)status.textContent='Afventer en ny Wi-Fi-måling fra trackeren. '+snapshot.points.length+' punkter fundet indtil nu.'+(Number.isFinite(o.at)?' Seneste Wi-Fi-scanning er '+Math.max(0,Math.floor((now()-o.at)/60000))+' min. gammel.':'')+' Et godt signal på mobilen betyder ikke, at trackeren har sendt en scanning.';
  else status.textContent='Søger · '+snapshot.points.length+' punkter fra '+snapshot.scans+' forskellige målinger. Flyt trackeren rundt, og vent på nye målinger.';
 }
 start.onclick=()=>{
  render();if(start.disabled)return;
  scan=createWifiScan();rows.clear();list.replaceChildren();chosen=new Set(readMacs().map(normalizeMac).filter(Boolean));running=true;used=false;saved=false;render();
 };
 stop.onclick=()=>{running=false;render();};
 use.onclick=()=>{
  render();if(use.disabled)return;
  try{const macs=mergeWifiSelection(readMacs(),[...chosen].filter(mac=>rows.has(mac)));onUse(macs);running=false;used=true;render();notice('Wi-Fi-punkterne er klar. Tryk Gem profil.');}catch(e){notice(e.message);}
 };
 return {update:render,clear,saved:()=>{if(key===context()&&used){used=false;saved=true;render();}}};
}
