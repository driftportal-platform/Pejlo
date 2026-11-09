export const defaultAlerts=()=>({exit:true,enter:true,lowBattery:false,batteryThreshold:20,missing:false,missingMinutes:30,quiet:false,quietStart:'22:00',quietEnd:'07:00'});
export function cleanAlerts(value){
 const d=defaultAlerts(),v=value||{};
 for(const key of ['exit','enter','lowBattery','missing','quiet'])if(typeof v[key]==='boolean')d[key]=v[key];
 if(Number.isInteger(v.batteryThreshold)&&v.batteryThreshold>=5&&v.batteryThreshold<=50)d.batteryThreshold=v.batteryThreshold;
 if(Number.isInteger(v.missingMinutes)&&v.missingMinutes>=5&&v.missingMinutes<=1440)d.missingMinutes=v.missingMinutes;
 for(const key of ['quietStart','quietEnd'])if(typeof v[key]==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v[key]))d[key]=v[key];
 if(v.areas&&typeof v.areas==='object'&&!Array.isArray(v.areas)){
  const areas=Object.fromEntries(Object.entries(v.areas).filter(([id,choice])=>id.length>0&&id.length<=100&&typeof choice?.enter==='boolean'&&typeof choice?.exit==='boolean').slice(0,20).map(([id,{enter,exit}])=>[id,{enter,exit}]));
  if(Object.keys(areas).length)d.areas=areas;
 }
 return d;
}
export function areaAlerts(config,areaId){
 return areaId&&config.areas&&Object.hasOwn(config.areas,areaId)?config.areas[areaId]:{enter:config.enter,exit:config.exit};
}
export function isQuiet(config,now=Date.now()){
 if(!config.quiet||config.quietStart===config.quietEnd)return false;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now));
 return config.quietStart<config.quietEnd?parts>=config.quietStart&&parts<config.quietEnd:parts>=config.quietStart||parts<config.quietEnd;
}
export function advanceAlerts(config,raw,previous={},now=Date.now()){
 const state={...previous},events=[];
 state.started??=now;
 const stamp=Date.parse(raw?.fixTime),valid=raw?.valid===true&&Number.isFinite(raw.latitude)&&Number.isFinite(raw.longitude)&&Math.abs(raw.latitude)<=90&&Math.abs(raw.longitude)<=180&&Number.isFinite(stamp)&&stamp<=now+60000;
 if(valid)state.lastFix=Math.max(state.lastFix||0,stamp);
 const missing=now-(state.lastFix??state.started)>=config.missingMinutes*60000;
 if(config.missing&&missing&&!state.missing)events.push('missing');
 state.missing=missing;
 const battery=raw?.attributes?.batteryLevel;
 if(valid&&now-stamp<=300000&&stamp>(state.batteryStamp||0)&&typeof battery==='number'&&battery>=0&&battery<=100){
  state.batteryStamp=stamp;
  if(config.lowBattery&&battery<=config.batteryThreshold&&!state.low)events.push('battery');
  if(battery<=config.batteryThreshold)state.low=true;
  else if(battery>=config.batteryThreshold+5)state.low=false;
 }
 return {state,events};
}
