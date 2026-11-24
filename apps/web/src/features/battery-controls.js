import {createBatteryPolicy} from './battery-policy.js';
export function createBatteryControls({root,selected,request,notice,canEdit}){
 const q=s=>root.querySelector(s);let key=null,generation=0,busy=false,enabled=false;
 const policy=createBatteryPolicy({root:q('[data-battery-policy]'),selected,request,canEdit,updated:render});
 function clear(){policy.clear();enabled=false;key=null;generation++;busy=false;q('[data-battery-status]').textContent='Vælg en tilknyttet tracker.';q('fieldset').disabled=true;q('[data-battery-history-output]').replaceChildren();q('[data-battery-history-status]').textContent='';q('[data-battery-history]').disabled=!selected()?.trackerId;}
 function render(result){
  enabled=result.enabled===true;policy.render(result);
  q('fieldset').disabled=!result.enabled||!canEdit();
  const last=result.last;
  q('[data-battery-status]').textContent=!result.enabled?'Batteristyring er endnu ikke aktiveret for denne tracker.':last?'Senest ønsket: '+last.seconds+' sek. · '+new Date(last.requested_at).toLocaleString('da-DK')+' · '+(last.status==='sent'?'sendt til Traccar; trackerens interval er ikke læst tilbage.':'afsendelse uafklaret eller afvist.'):'Vælg et interval. Ingen ændring sendes, før du trykker Anvend.';
 }
 async function load(force=false){
  const id=selected()?.trackerId||null;if(!force&&key===id)return;clear();key=id;if(!id)return;
  const gen=generation;q('[data-battery-status]').textContent='Henter batteriindstillinger…';
  try{const result=await request('battery?identifier='+encodeURIComponent(id));if(gen===generation&&key===id)render(result);}
  catch(e){if(gen===generation){key=null;q('[data-battery-status]').textContent=e.message;}}
 }
 q('[data-battery-apply]').onclick=async()=>{
  const id=selected()?.trackerId;if(busy||!id||id!==key||!canEdit())return;
  const seconds=Number(q('select').value);
  if(seconds===120&&!confirm('120 sekunder er afprøvet på Loui-trackeren, men batterigevinsten er ikke målt. Vil du bruge 120 sekunder?'))return;
  const gen=generation;busy=true;q('fieldset').disabled=true;
  try{const result=await request('battery',{identifier:id,seconds,testConfirmed:seconds===120});if(gen===generation&&key===id){render(result);notice('Intervalønsket er sendt. Kontrollér de næste rapporter.');}}
  catch(e){if(gen===generation)q('[data-battery-status]').textContent=e.message;}
  finally{if(gen===generation){busy=false;q('fieldset').disabled=!enabled||!canEdit();}}
 };
 q('[data-battery-refresh]').onclick=()=>{if(!busy)load(true);};
 q('[data-battery-history]').onclick=async()=>{
  const id=selected()?.trackerId;if(!id)return;const gen=generation,button=q('[data-battery-history]'),status=q('[data-battery-history-status]'),output=q('[data-battery-history-output]');button.disabled=true;status.textContent='Henter batterihistorik…';
  try{
   const result=await request('battery/history?identifier='+encodeURIComponent(id)+'&days='+q('[data-battery-days]').value);if(gen!==generation||selected()?.trackerId!==id)return;
   const doc=root.ownerDocument;output.replaceChildren();
   status.textContent=result.count+' gemte positionsrapporter i perioden'+(result.truncated?' · Ufuldstændig historik: grænsen på 10.000 poster er nået.':'.')+(result.first&&result.last?' Batteri: '+result.first.level+' % → '+result.last.level+' %.':' Ingen batterimålinger i perioden.');
   function table(headers,rows){const t=doc.createElement('table');t.className='battery-history-table';const head=doc.createElement('thead'),tr=doc.createElement('tr');for(const title of headers){const th=doc.createElement('th');th.scope='col';th.textContent=title;tr.append(th);}head.append(tr);t.append(head);const body=doc.createElement('tbody');for(const row of rows){const tr=doc.createElement('tr');for(const v of row){const td=doc.createElement('td');td.textContent=String(v);tr.append(td);}body.append(tr);}t.append(body);output.append(t);}
   const date=at=>new Date(at).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
   table(['Periode fra','Batteri','Opladning','Rapporter'],result.buckets.map(b=>[date(b.at),b.battery==null?'—':b.battery+' %',b.charging==null?'—':b.charging?'Ja':'Nej',b.count]));
   const heading=doc.createElement('h4');heading.textContent='Intervalændringer i perioden';output.append(heading);
   if(result.changes.length)table(['Tid','Ønsket interval','Afsendelse'],result.changes.map(e=>[date(e.at),e.seconds+' sek.',({sent:'Sendt til Traccar',uncertain:'Uafklaret',rejected:'Afvist',pending:'Ikke afsluttet'})[e.status]||'Ukendt']));
   else{const p=doc.createElement('p');p.textContent='Ingen registrerede intervalændringer. Historikken starter med denne appversion; manuelle Traccar-kommandoer registreres ikke her.';output.append(p);}
  }catch(e){if(gen===generation)status.textContent=e.message;}
  finally{if(gen===generation)button.disabled=false;}
 };
 return {load,clear};
}
