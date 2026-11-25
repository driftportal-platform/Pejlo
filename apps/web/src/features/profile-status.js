import {petActivityStatus} from '../shared/rest-observation.js';
import {icon} from '../components/icons.js';
import {reportStatus} from '../shared/report-status.js';
import {homeWifiStatus} from '../shared/home-wifi.js';
import {signalStatus} from './signal-bar.js';
import {gpsStatus} from '../shared/gps-status.js';

const fresh=(at,now,age=300000)=>Number.isFinite(at)&&at<=now+10000&&now-at<=age;
export function profileStatuses(data,profile,now=Date.now()){
 const item=(key,symbol,label,tone='unknown',detail='Ukendt')=>({key,symbol,label,tone,detail});
 const items=[item('sleep','moon','Hvile'),item('active','pulse','Bevægelse'),item('gps','satellite','GPS'),item('mobile','mobile','Mobilnet'),item('wifi','wifi','Wi-Fi'),item('battery','battery','Batteri'),item('charging','charge','Opladning')];
 if(!profile?.trackerId||data?.source!=='traccar'||data?.device?.identifier!==profile.trackerId)return items;
 const [sleep,active,gps,mobile,wifi,battery,charging]=items,t=data.telemetry,offline=data.device.status==='offline',mode=reportStatus(data,now);
 const activity=petActivityStatus(data,profile,now);
 sleep.detail=activity.detail+' '+mode.note;
 if(activity.state==='rest')sleep.tone='good';
 if(offline){active.tone='bad';active.detail='Tracker offline; aktivitet ukendt.';}
 else{active.tone=activity.state==='moving'?'good':'unknown';active.detail=activity.label+'. '+activity.detail;}
 const signals=signalStatus(data,now);
 mobile.level=signals.mobile.level;
 mobile.detail=signals.mobile.value+' · '+signals.mobile.note;
 if(!offline&&signals.mobile.tone!=='unknown')mobile.tone=signals.mobile.tone==='poor'?'bad':'good';
 gps.detail=signals.satellite.value+' · '+gpsStatus(data,now).label;
 if(!offline&&fresh(t?.receivedAt,now)){
  const p=data.position;
  if(t?.satellites===0||t?.gpsClockAhead||data.gpsUncertain||data.gpsProvisional)gps.tone='bad';
  else if(p&&fresh(p.timestamp,now)&&p.valid!==false&&!p.approximate&&!gpsStatus(data,now).waiting)gps.tone='good';
 }
 const w=homeWifiStatus(data,profile.homeWifi,now),strongest=w.points[0];
 wifi.level=w.fresh&&strongest?(strongest.rssi>=-50?3:strongest.rssi>=-75?2:1):0;
 wifi.detail=!w.config.macs.length?'Hjemmets Wi-Fi er ikke sat op':!w.fresh?'Afventer en frisk Wi-Fi-scanning':strongest?strongest.rssi+' dBm · hjemmets Wi-Fi registreret':'Hjemmets Wi-Fi ikke set i seneste scanning; det beviser ikke, at trackeren er udenfor.';
 if(w.config.macs.length&&w.fresh)wifi.tone=strongest&&strongest.rssi>=-75?'good':'bad';
 if(!offline&&fresh(t?.batteryMeasuredAt??t?.receivedAt,now,900000)&&Number.isFinite(t?.battery)&&t.battery>=0&&t.battery<=100){battery.tone=t.battery>20?'good':'bad';battery.detail=t.battery+' %';battery.percent=t.battery;}
 else battery.detail='Batteristatus ukendt eller for gammel';
 if(!offline&&fresh(t?.receivedAt,now)&&typeof t?.charging==='boolean'){charging.tone=t.charging?'good':'bad';charging.detail=t.charging?'Oplader':'Oplader ikke';}
 else charging.detail='Opladningsstatus ukendt eller for gammel';
 battery.charging=data.device.status==='online'&&charging.tone==='good';
 if(battery.charging){battery.tone='good';battery.detail+=' · Oplader';}
 return items;
}
function statusIcon(s){
 const svg=paths=>'<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
 if(s.key==='battery')return svg('<rect x="1" y="6" width="19" height="12" rx="3"/><path d="M23 10v4"/>'+(s.charging&&s.percent!==100?[0,1,2].map(i=>'<rect class="battery-charge-step battery-charge-step-'+i+'" x="'+(3+i*5.2)+'" y="8" width="4" height="8" rx=".7" fill="currentColor" stroke="none"/>').join(''):Number.isFinite(s.percent)?'<rect x="3" y="8" width="'+Math.max(0,Math.min(100,s.percent))*15/100+'" height="8" rx="1" fill="currentColor" stroke="none"/>':'<path d="M7 12h7" opacity=".4"/>'));
 if(s.key==='mobile')return svg([0,1,2,3].map(i=>'<path d="M'+(3+i*6)+' 20v-'+(3+i*5)+'" stroke-width="3.5" opacity="'+(s.tone!=='unknown'&&i<(s.level||0)?1:.22)+'"/>').join(''));
 if(s.key==='wifi')return svg(['<circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>','<path d="M8.5 16a5.5 5.5 0 0 1 7 0"/>','<path d="M5 12a11 11 0 0 1 14 0"/>','<path d="M2 8a16 16 0 0 1 20 0"/>'].map((path,i)=>'<g opacity="'+(s.tone!=='unknown'&&i<=(s.level||0)?1:.22)+'">'+path+'</g>').join(''));
 return icon(s.symbol,21);
}
export const statusHelp={
 sleep:'Månen viser mulig hvile ud fra mindst 15 minutters lav GPS-hastighed og positioner inden for 25 meter. Trackeren skal være markeret som påsat og må ikke oplade. Grøn betyder et frisk estimat – ikke målt søvn. Grå betyder, at hvile ikke kan vurderes. En gammel dvalerapport beviser ikke aktuel hvile.',
 active:'Pulsen viser GPS-vurderet bevægelse. Grøn kræver to friske målinger med hastighed og forskydning. Grå betyder, at bevægelse ikke kan bekræftes; det beviser ikke hvile. Rød betyder offline. At trackeren sender rapporter, er ikke i sig selv bevægelse.',
 gps:'Satellitten viser, om appen har en frisk, godkendt GPS-position. Grøn er en brugbar position. Rød kan betyde nul satellitter, tidsfejl eller en position, der afventer godkendelse. Antallet af satellitter er ikke i sig selv et mål for præcision.',
 mobile:'Stregerne viser trackerens mobilnet, ikke telefonens. Grøn betyder et brugbart rapporteret signal, rød et svagt signal. Antallet af streger følger RSSI. Manglende, gammel eller ukendt signalskala vises grå.',
 wifi:'Buerne viser styrken af hjemmets valgte Wi-Fi-punkter i trackerens seneste scanning. Grøn betyder mindst ét punkt med signal på mindst −75 dBm. Rød betyder svagere signal eller ingen af hjemmets punkter i en frisk scanning. Det beviser ikke, at trackeren er udenfor. Grå betyder manglende opsætning eller en gammel/manglende scanning.',
 battery:'Under opladning fyldes batteriets streger i en animation. Animationen viser opladning, ikke en målt stigning i procent. Ved 100 % vises et fuldt batteri uden bevægelse. Ellers følger batteriets fyld den målte procent. Grøn betyder opladning eller over 20 %. Uden opladning betyder rød 20 % eller derunder. Grå betyder, at målingen mangler, er gammel eller at trackeren er offline.',
 charging:'Lynet viser opladning. Grøn betyder oplader. Rød betyder oplader ikke — det er normalt, når trackeren er på dyret eller genstanden, og er ikke i sig selv en fejl. Grå betyder ukendt eller gammel oplysning.'
};
export function createProfileStatusHelp(doc){
 const dialog=doc.createElement('dialog');dialog.className='sheet profile-status-help';dialog.setAttribute('aria-labelledby','profile-status-help-title');
 const head=doc.createElement('div');head.className='sheet-head';
 const title=doc.createElement('h2');title.id='profile-status-help-title';
 const close=doc.createElement('button');close.type='button';close.className='icon-button';close.setAttribute('aria-label','Luk forklaring');close.textContent='×';
 const current=doc.createElement('p');current.className='profile-status-current';current.setAttribute('aria-live','polite');
 const explanation=doc.createElement('p'),legend=doc.createElement('p');legend.className='hint';legend.textContent='Farven gælder dette symbol. Grå betyder ukendt eller for gammel måling.';
 head.append(title,close);dialog.append(head,current,explanation,legend);doc.body.append(dialog);
 close.onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 let key=null,profileId=null;
 function fill(status,profile){title.textContent=profile.name+' · '+status.label;current.textContent='Aktuelt: '+status.detail;current.dataset.tone=status.tone;explanation.textContent=statusHelp[status.key];}
 return {show(status,profile){key=status.key;profileId=profile.id;fill(status,profile);if(!dialog.open)dialog.showModal();},update(data,profile){if(!dialog.open)return;if(!profile||profile.id!==profileId){dialog.close();return;}const s=profileStatuses(data,profile).find(s=>s.key===key);if(s)fill(s,profile);},close(){if(dialog.open)dialog.close();}};
}
export function renderProfileStatus(root,data,profile,now=Date.now(),onExplain=null){
 const statuses=profileStatuses(data,profile,now),doc=root.ownerDocument;
 const previous=Array.from(root.children||[]);
 const elements=statuses.map((s,i)=>{
  const el=previous[i]||doc.createElement('button');el.type='button';el.className='profile-status-icon';el.dataset.tone=s.tone;el.dataset.charging=s.charging?'true':'false';
  el.setAttribute('aria-label',s.label+': '+s.detail+'. Vis forklaring');el.setAttribute('aria-haspopup','dialog');el.title=s.label+': '+s.detail;
  const markup=statusIcon(s);if(el._statusMarkup!==markup){el.innerHTML=markup;el._statusMarkup=markup;}
  el.onclick=()=>onExplain?.(s,profile);return el;
 });
 // The age clock runs every second. Preserve SVG nodes so charging animations
 // can finish their cycle and keyboard focus stays on the selected icon.
 if(previous.length!==elements.length)root.replaceChildren(...elements);
 root.hidden=!profile?.trackerId;
}
