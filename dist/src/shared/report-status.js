const fresh=(at,now,maxAge)=>Number.isFinite(at)&&at<=now+60000&&now-at<=maxAge;
export function reportStatus(data,now=Date.now()){
 const r=data?.reportState,at=r?.lastSleepAt;
 const sleepAt=Number.isFinite(at)&&at<=now+60000?at:null;
 const lastReport=Math.max(r?.lastPositionReportAt||0,r?.lastQueryReportAt||0);
 let label='Dvalestatus ukendt',tone='unknown';
 if(data?.device?.status==='offline')label='Offline · dvalestatus ukendt';
 else if(fresh(sleepAt,now,900000)&&lastReport<=sleepAt){label='Dvalerapport modtaget';tone='sleep';}
 else if(fresh(lastReport,now,300000))label='Sender rapporter';
 const note=sleepAt?'Dvale senest bekræftet '+new Date(sleepAt).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'.'+(lastReport>sleepAt?' Der er kommet en ny rapport bagefter; det beviser ikke bevægelse.':''):'Der er endnu ingen dvalerapport fra statuslæseren. Nye rapporter beviser ikke, at dyret er vågent.';
 return {label,tone,note,sleepAt};
}
