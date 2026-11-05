// Push texts. Shared by the notification runner and the family API.
export const label=value=>String(value??'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,40);
export const messages={
 exit:(n,c)=>n+' har forladt '+c.area+'.',
 enter:(n,c)=>n+' er tilbage i '+c.area+'.',
 battery:(n,c)=>'Batteriet på '+n+' er lavt'+(Number.isFinite(c.battery)?' ('+Math.round(c.battery)+' %)':'')+'.',
 missing:n=>'Der mangler nye GPS-positioner fra '+n+'.',
 fencechange:(n,c)=>label(c.who||'En bruger')+(c.disabled?' har slået områdeovervågningen fra for ':' har ændret området for ')+n+'.'
};
export function notificationPayload(kind,identifier,context){
 const name=label(context.name)||'En tracker';
 return {title:'Pejlo',body:messages[kind](name,context)+' Åbn Pejlo for at se mere.',tag:'pejlo-'+kind+'-'+identifier,tracker:identifier,url:'/#kort'};
}
