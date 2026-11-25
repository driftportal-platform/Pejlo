import {petActivityStatus} from '../shared/rest-observation.js';
import {reportStatus} from '../shared/report-status.js';

const fresh=(at,now,age=300000)=>Number.isFinite(at)&&at<=now+10000&&now-at<=age;
export function profileState(data,profile,now=Date.now()){
 const state=(label,tone,detail)=>({label,tone,detail});
 if(!profile?.trackerId)return state('Ikke tilknyttet','unknown','Profilen har ingen tilknyttet tracker.');
 if(data?.source!=='traccar'||data.device?.identifier!==profile.trackerId)return state('Afventer','unknown','Afventer data fra den valgte tracker.');
 if(data.device.status==='offline')return state('Offline','offline','Trackeren er meldt offline. Seneste position kan stadig vises på kortet.');
 if(data.device.status!=='online')return state('Ukendt','unknown','Trackerens aktuelle forbindelse er ukendt.');
 if(fresh(data.telemetry?.receivedAt,now)&&data.telemetry?.charging===true)return state('Oplader','charging','Trackeren rapporterer opladning. Det tæller ikke som dyrets hvile.');
 const mode=reportStatus(data,now);
 if(mode.tone==='sleep'&&mode.sleepAt<=now)return state('Dvale','sleep','Frisk dvalerapport fra trackeren. Det beviser ikke, at dyret sover. '+mode.note);
 const activity=petActivityStatus(data,profile,now);
 if(activity.state==='moving')return state('Aktiv','active','I bevægelse. '+activity.detail);
 if(activity.state==='rest')return state('Mulig hvile','rest',activity.detail);
 const report=Math.max(data.reportState?.lastPositionReportAt||0,data.reportState?.lastQueryReportAt||0,data.reportState?.lastHeartbeatAt||0);
 if(fresh(data.device.lastContact,now)||fresh(report,now)||fresh(data.telemetry?.receivedAt,now))return state('Online','online','Frisk kontakt med trackeren. Aktivitet og dvale kan ikke fastslås. '+activity.detail);
 return state('Afventer','unknown','Trackeren står som online, men der mangler frisk kontakt til en aktuel status.');
}
export function renderProfileState(root,data,profile,now=Date.now()){
 const value=profileState(data,profile,now);
 if(root.textContent!==value.label)root.textContent=value.label;
 root.dataset.tone=value.tone;root.title=value.detail;root.hidden=!profile;
 root.setAttribute('aria-label','Trackerstatus: '+value.label+'. '+value.detail);
 return value;
}
