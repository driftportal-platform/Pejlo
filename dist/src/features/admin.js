export function createAdmin({request}){
 const $=s=>document.querySelector(s);let generation=0,usageGeneration=0,allowed=false;
 function clear(){generation++;usageGeneration++;allowed=false;$('#admin-usage').replaceChildren();$('#admin-usage-message').textContent='';$('#admin-usage-reload').disabled=false;$('#admin-status').hidden=true;$('#admin-summary').replaceChildren();$('#admin-runs').replaceChildren();$('#admin-push-users').replaceChildren();$('#admin-message').textContent='';}
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
 async function loadUsage(){
  if(!allowed)return;
  const gen=++usageGeneration,root=$('#admin-usage'),message=$('#admin-usage-message'),button=$('#admin-usage-reload');
  button.disabled=true;
  root.replaceChildren();
  message.textContent='Henter forbrug…';
  try{
   const data=await request('admin/usage');
   if(gen!==usageGeneration)return;
   const number=new Intl.NumberFormat('da-DK',{maximumFractionDigits:0});
   const percent=new Intl.NumberFormat('da-DK',{style:'percent',maximumFractionDigits:1});
   const counter=(label,value,limit)=>paragraph(root,
    label+' · '+number.format(value)+' af '+number.format(limit)+' ('+percent.format(value/limit)+')');
   const show=(label,usage,period,render)=>{
    if(usage.status!=='ok'){
     paragraph(root,label+' · '+(usage.status==='unconfigured'?'Mangler adgang til målinger.':'Målingerne kunne ikke hentes.'));
     return;
    }
    paragraph(root,label+' · '+usage.day+' ('+period+')');
    render();
   };
   show('Cloudflare',data.cloudflare,'UTC, hele kontoen',()=>{
    counter('Workers-forespørgsler',data.cloudflare.workers,100000);
    counter('D1 · læste rækker',data.cloudflare.rowsRead,5000000);
    counter('D1 · skrevne rækker',data.cloudflare.rowsWritten,100000);
   });
   show('Firebase Firestore',data.firestore,'californisk tid, standarddatabasen',()=>{
    counter('Læste dokumenter',data.firestore.reads,50000);
    counter('Skrevne dokumenter',data.firestore.writes,20000);
   });
   const checkedAt=new Date(data.checkedAt).toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'});
   message.textContent='Hentet kl. '+checkedAt+'. Tallene kan være forsinkede. Procenterne bruger gratisplanernes grænser.';
  }catch(e){
   if(gen===usageGeneration)message.textContent=e.message;
  }finally{
   if(gen===usageGeneration)button.disabled=false;
  }
 }
 $('#admin-usage-reload').onclick=loadUsage;
 $('#admin-reload').onclick=load;return {clear,enable,load};
}
