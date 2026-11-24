import {renderHistoryChart} from './history-charts.js';
import {createPositionRefresh} from './position-refresh.js';
import {createBatteryPolicy} from './battery-policy.js';
export function createBatteryControls({root,selected,request,notice,canEdit}){
 const q=s=>root.querySelector(s);let key=null,generation=0,busy=false,enabled=false,historyGeneration=0,historyLoaded=false;
 const recovery=createPositionRefresh({root:q('[data-position-refresh]'),selected,request,canEdit});
 const policy=createBatteryPolicy({root:q('[data-battery-policy]'),selected,request,canEdit,updated:render});
 function clear(){historyGeneration++;historyLoaded=false;if(q('[data-battery-history-details]'))q('[data-battery-history-details]').open=false;recovery.clear();policy.clear();enabled=false;key=null;generation++;busy=false;q('[data-battery-status]').textContent='Vælg en tilknyttet tracker.';q('fieldset').disabled=true;q('[data-battery-history-output]').replaceChildren();q('[data-battery-history-status]').textContent='';q('[data-battery-history]').disabled=!selected()?.trackerId;}
 function render(result){
  enabled=result.enabled===true;policy.render(result);
  q('fieldset').disabled=!result.enabled||!canEdit();
  const last=result.last;
  q('[data-battery-status]').textContent=!result.enabled?'Batteristyring er endnu ikke aktiveret for denne tracker.':last?'Senest ønsket: '+last.seconds+' sek. · '+new Date(last.requested_at).toLocaleString('da-DK')+' · '+(last.status==='sent'?'sendt til Traccar; trackerens interval er ikke læst tilbage.':'afsendelse uafklaret eller afvist.'):'Vælg et interval. Ingen ændring sendes, før du trykker Anvend.';
 }
 async function load(force=false){
  const id=selected()?.trackerId||null;if(!force&&key===id)return;clear();key=id;if(!id)return;void recovery.load();
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
 async function loadHistory(){
  const id=selected()?.trackerId;if(!id)return;const gen=generation,historyGen=++historyGeneration,button=q('[data-battery-history]'),status=q('[data-battery-history-status]'),output=q('[data-battery-history-output]');button.disabled=true;status.textContent='Henter batterihistorik…';
  try{
   const result=await request('battery/history?identifier='+encodeURIComponent(id)+'&days='+q('[data-battery-days]').value);if(gen!==generation||historyGen!==historyGeneration||selected()?.trackerId!==id)return;
   const doc=root.ownerDocument;output.replaceChildren();historyLoaded=true;
   status.textContent=result.count+' gemte positionsrapporter i perioden'+(result.truncated?' · Ufuldstændig historik: grænsen på 10.000 poster er nået.':'.')+(result.first&&result.last?' Batteri: '+result.first.level+' % → '+result.last.level+' %.':' Ingen batterimålinger i perioden.');
   function table(headers,rows,parent=output){const t=doc.createElement('table');t.className='battery-history-table';const head=doc.createElement('thead'),tr=doc.createElement('tr');for(const title of headers){const th=doc.createElement('th');th.scope='col';th.textContent=title;tr.append(th);}head.append(tr);t.append(head);const body=doc.createElement('tbody');for(const row of rows){const tr=doc.createElement('tr');for(const v of row){const td=doc.createElement('td');td.textContent=String(v);tr.append(td);}body.append(tr);}t.append(body);const scroll=doc.createElement('div');scroll.className='history-table-scroll';scroll.tabIndex=0;scroll.append(t);parent.append(scroll);}
   const date=at=>new Date(at).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
   const graphs=doc.createElement('div');graphs.className='history-charts';output.append(graphs);
   const labels=result.buckets.map(b=>date(b.at)),batteryChart=doc.createElement('div'),reportChart=doc.createElement('div');
   graphs.append(batteryChart);
   renderHistoryChart(batteryChart,{title:'Batteriniveau',labels,values:result.buckets.map(b=>b.battery),unit:'%',max:100,kind:'line',notes:result.buckets.map(b=>b.charging===true?'Oplader':b.charging===false?'Batteridrift':'Strømstatus ukendt')});
   const hint=doc.createElement('p');hint.className='hint';hint.textContent='Seneste batterimåling pr. '+(q('[data-battery-days]').value==='7'?'døgn':'time')+'. Orange punkter = opladning. Huller betyder manglende målinger; de forbindes ikke.';output.append(hint);
   const reports=doc.createElement('details'),reportsTitle=doc.createElement('summary');reports.className='fold-section';reportsTitle.textContent='Rapportgraf og målinger ('+result.count+' rapporter)';reports.append(reportsTitle,reportChart);output.append(reports);
   renderHistoryChart(reportChart,{title:'Gemte positionsrapporter',labels,values:result.buckets.map(b=>b.count),unit:'rapporter',tone:'blue'});
   table(['Periode fra','Batteri','Opladning','Rapporter'],result.buckets.map(b=>[date(b.at),b.battery==null?'-':b.battery+' %',b.charging==null?'-':b.charging?'Ja':'Nej',b.count]),reports);
   const changes=doc.createElement('details'),heading=doc.createElement('summary');changes.className='fold-section';heading.textContent='Kommandolog · '+result.changes.length+' intervalændringer';changes.append(heading);output.append(changes);
   if(result.changes.length)table(['Tid','Ønsket interval','Afsendelse'],result.changes.map(e=>[date(e.at),e.seconds+' sek.',({sent:'Sendt til Traccar',uncertain:'Uafklaret',rejected:'Afvist',pending:'Ikke afsluttet'})[e.status]||'Ukendt']),changes);
   else{const p=doc.createElement('p');p.textContent='Ingen registrerede intervalændringer. Manuelle Traccar-kommandoer registreres ikke her.';changes.append(p);}
  }catch(e){if(gen===generation&&historyGen===historyGeneration)status.textContent=e.message;}
  finally{if(gen===generation&&historyGen===historyGeneration)button.disabled=false;}
 }
 q('[data-battery-history]').onclick=loadHistory;
 q('[data-battery-history-details]')?.addEventListener('toggle',()=>{if(q('[data-battery-history-details]').open&&!historyLoaded)void loadHistory();});
 if(q('[data-battery-days]'))q('[data-battery-days]').onchange=loadHistory;
 return {load,clear};
}
