export function createAdmin({request}){
 const $=s=>document.querySelector(s);let generation=0,allowed=false;
 function clear(){generation++;allowed=false;$('#admin-status').hidden=true;$('#admin-summary').replaceChildren();$('#admin-runs').replaceChildren();$('#admin-push-users').replaceChildren();$('#admin-message').textContent='';}
 function enable(value){allowed=value;$('#admin-status').hidden=!value;if(!value)clear();}
 const paragraph=(root,text)=>{const p=document.createElement('p');p.textContent=text;root.append(p);};
 async function load(){
  if(!allowed)return;const gen=++generation;$('#admin-message').textContent='Henter driftsstatus…';
  try{const v=await request('admin/status');if(gen!==generation)return;$('#admin-summary').replaceChildren();$('#admin-runs').replaceChildren();$('#admin-push-users').replaceChildren();
   paragraph($('#admin-summary'),v.counts.trackers+' trackere · '+v.counts.claimed+' tilknyttet · '+v.counts.profiles+' fælles profiler · '+v.counts.fences+' aktive områder · '+v.counts.pushDevices+' pushenheder · '+v.counts.queued+' beskeder i kø.');
   paragraph($('#admin-summary'),'Opsætning: Traccar '+(v.configured.traccar?'klar':'mangler')+' · push '+(v.configured.push?'klar':'mangler')+' · mail '+(v.configured.mail?'klar':'mangler')+'.');
   const latest=v.runs[0],stale=!latest||v.checkedAt-latest.started_at>180000;
   $('#admin-message').textContent=!latest?'Ingen baggrundskørsel registreret endnu. Kontrollér Cron Trigger hvert minut.':stale?'Ingen ny baggrundskørsel de seneste 3 minutter. Kontrollér Cron Trigger og Cloudflare-logs.':'Status hentet. Tallene beskriver serveren; push-tilmelding bekræfter ikke modtagelse på en telefon.';
   const labels={completed:'Gennemført',partial:'Gennemført med fejl',failed:'Fejlet',running:'Kører / endnu ikke afsluttet','missing-token':'Traccar-nøgle mangler'};
   for(const run of v.runs){paragraph($('#admin-runs'),new Date(run.started_at).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen'})+' · '+(labels[run.status]||run.status)+' · '+run.checked+' trackere kontrolleret · '+run.errors+' behandlingsfejl · '+run.upstream_errors+'/'+run.upstream_requests+' Traccar-kald med fejl');}
   for(const u of v.pushUsers)paragraph($('#admin-push-users'),'Bruger-ID '+u.uid+' · '+u.devices+' tilmeldte enheder');
   if(!v.pushUsers.length)paragraph($('#admin-push-users'),'Ingen tilmeldte pushenheder.');
   if(v.pushUsersTruncated)paragraph($('#admin-push-users'),'Viser de første 100 konti.');
  }catch(e){if(gen===generation)$('#admin-message').textContent=e.message;}
 }
 $('#admin-reload').onclick=load;return {clear,enable,load};
}
