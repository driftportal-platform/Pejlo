import {attachmentText} from '../shared/attachment.js';
import {animalType,activityAdvice,activityDates,mergeActivity,activityCsv} from '../shared/activity.js';
import {danishDate} from '../shared/history.js';
import {renderActivityOverview,renderHistoryChart,shortDay} from './history-charts.js';

export function createActivity({root,selected,request,notice,scope=()=>''}){
 const q=s=>root.querySelector('[data-activity-'+s+']'),doc=root.ownerDocument;
 let key=null,generation=0,busy=false,loaded=false,model=null,gps=[],gpsBusy=false,gpsGeneration=0,gpsState='idle';
 const context=()=>{const p=selected();return p&&animalType(p.type)?JSON.stringify([scope(),p.id,p.trackerId||'',p.type]):null;};
 const identity=()=>{const p=selected();return {profileId:p.id,identifier:p.trackerId||'',type:p.type};};
 const number=e=>e.value.trim()===''?null:Number(e.value.replace(',','.'));
 const num=v=>v==null?'—':Number(v).toLocaleString('da-DK',{maximumFractionDigits:2});
 const day=()=>q('day').value;
 const range=()=>({from:q('from').value,to:q('to').value});
 function disabled(){for(const s of ['day-fields','goal-fields'])q(s).disabled=!loaded||busy||!model?.canEdit;q('gps').disabled=!loaded||busy||gpsBusy||!selected()?.trackerId;q('load').disabled=busy;q('export').disabled=!loaded||busy||gpsBusy;}
 function clearCharts(){if(q('auto-status'))q('auto-status').textContent='';if(q('attachment'))q('attachment').textContent='';for(const s of ['overview','km-chart','rest-chart'])q(s)?.replaceChildren();}
 function clear(){generation++;gpsGeneration++;gpsBusy=false;gpsState='idle';key=null;busy=false;loaded=false;model=null;gps=[];root.hidden=true;clearCharts();for(const detail of root.querySelectorAll?.('details')||[])detail.open=false;q('rows').replaceChildren();q('status').textContent='';q('gps-status').textContent='';q('summary').textContent='';q('progress').textContent='';q('km').value='';q('rest').value='';q('note').value='';disabled();}
 function sync(){
  const next=context();if(next){q('title').textContent='Motion og hvile for '+selected().name;if(q('attachment'))q('attachment').textContent=attachmentText(selected());}if(next===key)return;
  clear();key=next;if(!next)return;root.hidden=false;q('title').textContent='Motion og hvile for '+selected().name;
  const advice=activityAdvice(selected().type);q('advice').textContent=advice.text;q('source').hidden=!advice.url;
  if(advice.url){q('source').href=advice.url;q('source').textContent=advice.label;}else q('source').removeAttribute('href');
  q('day').value=q('to').value=q('day').max=q('from').max=q('to').max=danishDate();
  q('from').value=new Date(Date.parse(danishDate())-6*86400000).toISOString().slice(0,10);
  q('status').textContent='Hent motionshistorik for at se og registrere data.';
 }
 function editDay(){
  const row=model?.entries.find(e=>e.day===day());q('km').value=row?.km??'';q('rest').value=row?.rest_hours??model?.restDays?.find(e=>e.day===day())?.estimatedRestHours??'';q('note').value=row?.note??'';
  q('delete').disabled=!loaded||busy||!model?.canEdit||!row;
 }
 function render(resetForm=true){
  q('day').min=model.from;q('day').max=model.to;if(day()<model.from||day()>model.to)q('day').value=model.to;
  const dates=activityDates(model.from,model.to),rows=mergeActivity(dates,model.entries,gps,model.restDays);q('rows').replaceChildren();
  let total=0,known=0,rest=0,restDays=0;
  for(const r of [...rows].reverse()){
   if(r.km!==null){total+=r.km;known++;}if(r.restHours!==null){rest+=r.restHours;restDays++;}
   const tr=doc.createElement('tr');
   for(const text of [r.day.split('-').reverse().join('.'),num(r.manualKm),num(r.gpsKm),r.restHours===null?'—':num(r.restHours)+' t'+(r.restSource==='estimated'?' · anslået':r.restSource==='registered'?' · registreret':' · rettet'),r.quietMinutes===null?'—':num(r.quietMinutes)+' min',r.coverageMinutes===null?'—':num(r.coverageMinutes)+' min',num(r.goalKm),r.note]){const td=doc.createElement('td');td.textContent=text;tr.append(td);}
   const cell=doc.createElement('td'),button=doc.createElement('button');button.type='button';button.className='text-button';button.textContent=model.canEdit?'Rediger':'Vis';button.onclick=()=>{q('day').value=r.day;editDay();if(q('entry-details'))q('entry-details').open=true;q('day').focus();};cell.append(button);tr.append(cell);q('rows').append(tr);
  }
  q('summary').textContent=known?'Distance i perioden: '+num(total)+' km fordelt på '+known+' dage med data. Manuelle dagstotaler har forrang over GPS-estimater.':!selected()?.trackerId?'Ingen manuelle kilometer registreret i perioden.':gpsState==='loading'?'Henter GPS-afstand. Ingen manuelle kilometer registreret.':gpsState==='failed'?'GPS-afstand kunne ikke hentes. Ingen manuelle kilometer registreret.':gpsState==='ready'?'Ingen brugbare GPS-intervaller eller manuelle kilometer i perioden.':'GPS-afstand er endnu ikke hentet. Ingen manuelle kilometer registreret.';
  if(restDays)q('summary').textContent+=' Samlet hvile: '+num(rest)+' timer fordelt på '+restDays+' dage.';
  const goal=model.settings.goal_km,today=rows.find(r=>r.day===danishDate());
  renderActivityOverview(q('overview'),rows,goal,danishDate());if(q('attachment'))q('attachment').textContent=attachmentText(selected());
  renderHistoryChart(q('km-chart'),{title:'Kilometer pr. dag',labels:rows.map(r=>shortDay(r.day)),values:rows.map(r=>r.km),unit:'km',notes:rows.map(r=>r.source==='manual'?'Manuelt registreret':r.source==='gps'?'GPS-estimat':'')});
  renderHistoryChart(q('rest-chart'),{title:'Samlet hvile pr. dag',labels:rows.map(r=>shortDay(r.day)),values:rows.map(r=>r.restHours),unit:'timer',max:24,tone:'blue',notes:rows.map(r=>r.restSource==='manual'?'Manuelt registreret / rettet':r.restSource==='registered'?'Registreret hvile, eventuelt suppleret med estimat':r.restSource==='estimated'?'Mulig hvile – estimat, ikke målt søvn':'Ingen hvilemålinger')});
  q('progress').textContent=goal==null?'Intet dagligt kilometermål valgt.':today?.km!=null?'I dag: '+num(today.km)+' af '+num(goal)+' km ('+Math.round(today.km/goal*100)+' %). '+(today.source==='gps'?'GPS-estimat.':'Manuelt registreret.'):'Dit nuværende daglige mål er '+num(goal)+' km. Ingen distance for i dag i den viste periode.';
  if(q('auto-status'))q('auto-status').textContent=!model.autoRestEnabled?'Automatisk hvile er slået fra. Perioder startet med hvileknappen tælles stadig.':model.restLimited?'For mange målinger i perioden. Vælg færre dage.':!selected()?.trackerId?'Forbind en tracker for at anslå hvile.':selected()?.attachment?.state!=='worn'?'Automatisk hvile er klar. Markér trackeren som påsat under Indstillinger, og gem profilen.':'Automatisk hvile er slået til. Sammenhængende GPS-ro i mindst 15 minutter eller dvalerapporter kan tælle som mulig hvile, når trackeren er påsat og ikke oplader. Datamangler er ukendte. Manuelle dagstotaler erstatter estimatet.';
  if(resetForm){q('goal').value=goal??'';if(q('auto-rest'))q('auto-rest').checked=model.autoRestEnabled!==false;editDay();}disabled();
 }
 async function load(){
  sync();if(!key||busy)return;const gen=generation,id=key;gpsGeneration++;gpsBusy=false;gpsState='idle';busy=true;loaded=false;clearCharts();disabled();q('rows').replaceChildren();q('summary').textContent='';q('progress').textContent='';q('gps-status').textContent='';q('status').textContent='Henter motionshistorik…';
  try{
   const {from,to}=range();activityDates(from,to);const result=await request('activity?'+new URLSearchParams({...identity(),from,to}));
   if(gen!==generation||context()!==id)return;
   model=result;loaded=true;gps=[];q('gps-status').textContent='';render();q('status').textContent=result.canEdit?'Historikken er hentet. Tomme felter betyder ukendt.':'Historikken er hentet. Du har læseadgang.';
  }catch(e){if(gen===generation){loaded=false;q('status').textContent=e.message;}}
  finally{if(gen===generation){busy=false;disabled();editDay();}}
  if(gen===generation&&context()===id&&loaded&&selected()?.trackerId)void loadGps();
 }
 async function save(action){
  sync();if(!loaded||busy||!model?.canEdit)return;
  const gen=generation,id=key,entry=model.entries.find(e=>e.day===day());
  const input=action==='goal'?{action,goalKm:number(q('goal')),revision:model.settings.revision,...(q('auto-rest')?{autoRestEnabled:q('auto-rest').checked}:{})}:{action,day:day(),km:number(q('km')),restHours:number(q('rest')),note:q('note').value,revision:entry?.revision??0};
  if(action==='delete'&&!confirm('Slet din manuelle registrering for '+day()+'? GPS-historikken bevares.'))return;
  busy=true;disabled();
  try{await request('activity',{...identity(),...input});if(gen!==generation||context()!==id)return;busy=false;await load();if(gen===generation)notice('Motionsdata er gemt.');}
  catch(e){if(gen===generation)q('status').textContent=e.message+' Dine indtastninger er bevaret; hent historikken igen ved konflikt.';}
  finally{if(gen===generation){busy=false;disabled();editDayAfterSave(action);}}
 }
 function editDayAfterSave(){q('delete').disabled=!loaded||busy||!model?.canEdit||!model?.entries.some(e=>e.day===day());}
 q('goal-form').onsubmit=e=>{e.preventDefault();void save('goal');};q('day-form').onsubmit=e=>{e.preventDefault();void save('day');};
 q('delete').onclick=()=>void save('delete');q('day').onchange=editDay;q('load').onclick=()=>void load();
 q('export').onclick=()=>{
  sync();if(!loaded||busy)return;
  const rows=mergeActivity(activityDates(model.from,model.to),model.entries,gps,model.restDays),url=URL.createObjectURL(new Blob([activityCsv(rows)],{type:'text/csv;charset=utf-8'}));
  const a=doc.createElement('a');a.href=url;a.download='Pejlo-motion-'+model.from+'-'+model.to+'.csv';doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 async function loadGps(){
  sync();if(!loaded||busy||gpsBusy||!selected()?.trackerId)return;
  const gen=generation,gpsGen=++gpsGeneration,id=key,identifier=selected().trackerId,type=selected().type,from=model.from,to=model.to;
  gpsBusy=true;gpsState='loading';q('gps-status').textContent='Henter automatisk GPS-punkter for perioden…';render(false);disabled();
  try{
   const result=await request('activity/gps?'+new URLSearchParams({...identity(),identifier,from,to}),undefined,55000);
   if(gen!==generation||gpsGen!==gpsGeneration||context()!==id)return;
   if(result.historyAvailable===false||!Array.isArray(result.days))throw Error('GPS-historikken kunne ikke hentes.');
   gps=result.days;if(Array.isArray(result.restDays)){model={...model,restDays:result.restDays,autoRestEnabled:result.autoRestEnabled,restLimited:result.restLimited};}gpsState='ready';render(false);
   const coverage=gps.reduce((sum,d)=>sum+d.observedMinutes,0);
   q('gps-status').textContent=(result.points?result.points+' GPS-punkter behandlet. '+(coverage>0?num(coverage)+' minutters brugbar GPS-dækning.':'Ingen sammenhængende måleperioder med brugbare punkter; afstanden kan ikke beregnes.'):result.chargingExcluded?'Ingen brugbare GPS-punkter tilbage efter udeladelse af opladning.':'Ingen GPS-punkter fundet i den valgte periode.')+' '+(result.cachedDays||0)+' dage genbrugt fra gemte dagstal. '+(result.chargingExcluded||0)+' opladningspunkter udeladt; de tæller ikke som motion eller hvile.'+(result.historyTruncated?' Ufuldstændigt: Traccars grænse på 10.000 punkter er nået.':'')+' Mulig hvile beregnes fra sammenhængende GPS-ro og dvalerapporter uden dobbelt optælling. Dine rettelser har forrang. Det er ikke målt søvn.';
  }catch(e){if(gen===generation&&gpsGen===gpsGeneration&&context()===id){gps=[];gpsState='failed';render(false);q('gps-status').textContent=e.message+' Manuelle registreringer er stadig tilgængelige. Tryk Opdatér GPS-oversigt for at prøve igen.';}}
  finally{if(gen===generation&&gpsGen===gpsGeneration){gpsBusy=false;disabled();}}
 }
 q('gps').onclick=loadGps;

 clear();return {sync,load,clear};
}
