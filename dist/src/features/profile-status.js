import {icon} from '../components/icons.js';
import {reportStatus} from '../shared/report-status.js';
import {homeWifiStatus} from '../shared/home-wifi.js';
import {signalStatus} from './signal-bar.js';
import {gpsStatus} from '../shared/gps-status.js';

const fresh=(at,now,age=300000)=>Number.isFinite(at)&&at<=now+10000&&now-at<=age;
export function profileStatuses(data,profile,now=Date.now()){
 const item=(key,symbol,label,tone='unknown',detail='Ukendt')=>({key,symbol,label,tone,detail});
 const items=[item('sleep','moon','Dvale'),item('active','pulse','Aktiv'),item('gps','satellite','GPS'),item('mobile','mobile','Mobilnet'),item('wifi','wifi','Wi-Fi'),item('battery','battery','Batteri'),item('charging','charge','Opladning')];
 if(!profile?.trackerId||data?.source!=='traccar'||data?.device?.identifier!==profile.trackerId)return items;
 const [sleep,active,gps,mobile,wifi,battery,charging]=items,t=data.telemetry,offline=data.device.status==='offline',mode=reportStatus(data,now);
 sleep.detail=mode.note;
 if(mode.tone==='sleep'){sleep.tone='good';sleep.detail='Dvalerapport modtaget inden for 15 minutter. '+mode.note;}
 const lastReport=Math.max(data.reportState?.lastPositionReportAt||0,data.reportState?.lastQueryReportAt||0);
 if(offline){active.tone='bad';active.detail='Tracker offline';}
 else if(data.device.status==='online'&&fresh(lastReport,now)){active.tone='good';active.detail='Sender rapporter. Det beviser ikke bevægelse eller at dyret er vågent.';}
 else active.detail='Aktuel rapportering ukendt; en heartbeat alene bekræfter ikke aktivitet.';
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
 return items;
}
function statusIcon(s){
 const svg=paths=>'<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
 if(s.key==='battery')return svg('<rect x="1" y="6" width="19" height="12" rx="3"/><path d="M23 10v4"/>'+(Number.isFinite(s.percent)?'<rect x="3" y="8" width="'+Math.max(0,Math.min(100,s.percent))*15/100+'" height="8" rx="1" fill="currentColor" stroke="none"/>':'<path d="M7 12h7" opacity=".4"/>'));
 if(s.key==='mobile')return svg([0,1,2,3].map(i=>'<path d="M'+(3+i*6)+' 20v-'+(3+i*5)+'" stroke-width="3.5" opacity="'+(s.tone!=='unknown'&&i<(s.level||0)?1:.22)+'"/>').join(''));
 if(s.key==='wifi')return svg(['<circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>','<path d="M8.5 16a5.5 5.5 0 0 1 7 0"/>','<path d="M5 12a11 11 0 0 1 14 0"/>','<path d="M2 8a16 16 0 0 1 20 0"/>'].map((path,i)=>'<g opacity="'+(s.tone!=='unknown'&&i<=(s.level||0)?1:.22)+'">'+path+'</g>').join(''));
 return icon(s.symbol,21);
}
export function renderProfileStatus(root,data,profile,now=Date.now()){
 const statuses=profileStatuses(data,profile,now),doc=root.ownerDocument;
 root.replaceChildren(...statuses.map(s=>{
  const el=doc.createElement('span');el.className='profile-status-icon';el.dataset.tone=s.tone;
  el.setAttribute('role','img');el.setAttribute('aria-label',s.label+': '+s.detail);el.title=s.label+': '+s.detail;el.innerHTML=statusIcon(s);return el;
 }));
 root.hidden=!profile?.trackerId;
}
