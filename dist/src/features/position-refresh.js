export function createPositionRefresh({root,selected,request,canEdit}){
 if(!root)return {clear(){},load(){}};
 const q=s=>root.querySelector('[data-position-refresh-'+s+']');let key=null,generation=0,busy=false,available=false;
 const notes={waiting:'Afventer næste kontrol eller pause mellem forsøg.',fresh:'GPS og kontakt er friske.',offline:'Trackeren er offline. Afventer forbindelse; ingen kommando sendes.',paused:'Pause efter tre forsøg. Genoptages efter frisk GPS og kontakt. Du kan også slå fra og til igen.',sent:'Forespørgsel sendt til Traccar. Afventer en ny GPS-position.',queued:'Traccar meldte kommandoen i kø. Ny position er ikke bekræftet.',uncertain:'Afsendelsen er uafklaret. Nyt automatisk forsøg sker tidligst efter 15 minutter.',cooldown:'En anden positionsforespørgsel er sendt for nylig.',unsupported:'Traccar tilbyder ikke positionsforespørgslen.',error:'Kontrollen kunne ikke gennemføres. Nyt forsøg ved næste kontrol.',missing:'Trackeren blev ikke fundet.'};
 function lock(){q('fieldset').disabled=!available||!canEdit()||busy;}
 function clear(){key=null;generation++;busy=false;available=false;lock();q('status').textContent='Vælg en tilknyttet tracker.';}
 function render(r){available=!!r.available;lock();q('enabled').checked=r.enabled===true;q('minutes').value=String(r.minutes||15);q('status').textContent=!available?'Funktionen er ikke aktiveret for denne tracker.':!r.enabled?'Automatisk forespørgsel er slået fra.':(notes[r.result]||'Afventer kontrol.')+(r.attempts?' '+r.attempts+' af højst 3 forsøg i denne periode.':'')+(r.lastAttempt?' Seneste forsøg: '+new Date(r.lastAttempt).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen'})+'.':'');}
 async function load(){
  clear();const id=selected()?.trackerId;key=id;if(!id)return;const gen=generation;
  try{const r=await request('position-refresh?identifier='+encodeURIComponent(id));if(gen===generation&&key===id)render(r);}catch(e){if(gen===generation)q('status').textContent=e.message;}
 }
 q('save').onclick=async()=>{
  const id=selected()?.trackerId;if(!available||!canEdit()||busy||id!==key)return;busy=true;lock();const gen=generation;
  try{const r=await request('position-refresh',{identifier:id,enabled:q('enabled').checked,minutes:Number(q('minutes').value)});if(gen===generation&&key===id)render(r);}catch(e){if(gen===generation)q('status').textContent=e.message;}finally{if(gen===generation){busy=false;lock();}}
 };
 q('refresh').onclick=()=>{if(!busy)void load();};clear();return {clear,load};
}
