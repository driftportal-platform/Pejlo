const fresh=(at,now,maxAge)=>Number.isFinite(at)&&at<=now+60000&&now-at<=maxAge;
export function reportStatus(data,now=Date.now()){
 const r=data?.reportState,at=r?.lastSleepAt;
 const sleepAt=Number.isFinite(at)&&at<=now+60000?at:null;
 const lastReport=Math.max(r?.lastPositionReportAt||0,r?.lastQueryReportAt||0);
 let label='Dvale: ukendt',tone='unknown';
 if(data?.device?.status!=='offline'&&fresh(sleepAt,now,900000)&&lastReport<=sleepAt){label='Dvale: rapport modtaget';tone='sleep';}
 const note=sleepAt?'Seneste dvalerapport: '+new Date(sleepAt).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'.'+(tone!=='sleep'?' Den fortæller ikke, om trackeren er i dvale nu.':''):'Der er endnu ikke modtaget en dvalerapport.';
 return {label,tone,note,sleepAt};
}
