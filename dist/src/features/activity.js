import {animalType,activityAdvice,activityDates,activityGps,mergeActivity,activityCsv} from '../shared/activity.js';
import {danishDate} from '../shared/history.js';

export function createActivity({root,selected,request,notice,scope=()=>''}){
 const q=s=>root.querySelector('[data-activity-'+s+']'),doc=root.ownerDocument;
 let key=null,generation=0,busy=false,loaded=false,model=null,gps=[];
 const context=()=>{const p=selected();return p&&animalType(p.type)?JSON.stringify([scope(),p.id,p.trackerId||'',p.type]):null;};
 const identity=()=>{const p=selected();return {profileId:p.id,identifier:p.trackerId||'',type:p.type};};
 const number=e=>e.value.trim()===''?null:Number(e.value.replace(',','.'));
 const num=v=>v==null?'—':Number(v).toLocaleString('da-DK',{maximumFractionDigits:2});
 const day=()=>q('day').value;
 const range=()=>({from:q('from').value,to:q('to').value});
 function disabled(){for(const s of ['day-fields','goal-fields'])q(s).disabled=!loaded||busy||!model?.canEdit;q('gps').disabled=!loaded||busy||!selected()?.trackerId;q('load').disabled=busy;q('export').disabled=!loaded||busy;}
 function clear(){generation++;key=null;busy=false;loaded=false;model=null;gps=[];root.hidden=true;q('rows').replaceChildren();q('status').textContent='';q('gps-status').textContent='';q('summary').textContent='';q('progress').textContent='';q('km').value='';q('rest').value='';q('note').value='';disabled();}
 function sync(){
  const next=context();if(next===key)return;
  clear();key=next;if(!next)return;root.hidden=false;q('title').textContent='Motion og hvile for '+selected().name;
  const advice=activityAdvice(selected().type);q('advice').textContent=advice.text;q('source').hidden=!advice.url;
  if(advice.url){q('source').href=advice.url;q('source').textContent=advice.label;}else q('source').removeAttribute('href');
  q('day').value=q('to').value=q('day').max=q('from').max=q('to').max=danishDate();
  q('from').value=new Date(Date.parse(danishDate())-6*86400000).toISOString().slice(0,10);
  q('status').textContent='Hent motionshistorik for at se og registrere data.';
 }
 function editDay(){
  const row=model?.entries.find(e=>e.day===day());q('km').value=row?.km??'';q('rest').value=row?.rest_hours??'';q('note').value=row?.note??'';
  q('delete').disabled=!loaded||busy||!model?.canEdit||!row;
 }
 function render(resetForm=true){
  q('day').min=model.from;q('day').max=model.to;if(day()<model.from||day()>model.to)q('day').value=model.to;
  const dates=activityDates(model.from,model.to),rows=mergeActivity(dates,model.entries,gps);q('rows').replaceChildren();
  let total=0,known=0,rest=0,restDays=0;
  for(const r of [...rows].reverse()){
   if(r.km!==null){total+=r.km;known++;}if(r.restHours!==null){rest+=r.restHours;restDays++;}
   const tr=doc.createElement('tr');
   for(const text of [r.day,num(r.manualKm),num(r.gpsKm),r.restHours===null?'—':num(r.restHours)+' t',r.quietMinutes===null?'—':num(r.quietMinutes)+' min',r.coverageMinutes===null?'—':num(r.coverageMinutes)+' min',num(r.goalKm),r.note]){const td=doc.createElement('td');td.textContent=text;tr.append(td);}
   const cell=doc.createElement('td'),button=doc.createElement('button');button.type='button';button.className='text-button';button.textContent=model.canEdit?'Rediger':'Vis';button.onclick=()=>{q('day').value=r.day;editDay();q('day').focus();};cell.append(button);tr.append(cell);q('rows').append(tr);
  }
  q('summary').textContent=known?'Distance i perioden: '+num(total)+' km fordelt på '+known+' dage med data. Manuelle dagstotaler har forrang over GPS-estimater.':'Ingen registreret distance i perioden.';
  if(restDays)q('summary').textContent+=' Registreret hvile: '+num(rest)+' timer fordelt på '+restDays+' dage.';
  const goal=model.settings.goal_km,today=rows.find(r=>r.day===danishDate());
  q('progress').textContent=goal==null?'Intet dagligt kilometermål valgt.':today?.km!=null?'I dag: '+num(today.km)+' af '+num(goal)+' km ('+Math.round(today.km/goal*100)+' %). '+(today.source==='gps'?'GPS-estimat.':'Manuelt registreret.'):'Dit nuværende daglige mål er '+num(goal)+' km. Ingen distance for i dag i den viste periode.';
  if(resetForm){q('goal').value=goal??'';editDay();}disabled();
 }
 async function load(){
  sync();if(!key||busy)return;const gen=generation,id=key;busy=true;loaded=false;disabled();q('rows').replaceChildren();q('summary').textContent='';q('progress').textContent='';q('gps-status').textContent='';q('status').textContent='Henter motionshistorik…';
  try{
   const {from,to}=range();activityDates(from,to);const result=await request('activity?'+new URLSearchParams({...identity(),from,to}));
   if(gen!==generation||context()!==id)return;
   model=result;loaded=true;gps=[];q('gps-status').textContent='';render();q('status').textContent=result.canEdit?'Historikken er hentet. Tomme felter betyder ukendt.':'Historikken er hentet. Du har læseadgang.';
  }catch(e){if(gen===generation){loaded=false;q('status').textContent=e.message;}}
  finally{if(gen===generation){busy=false;disabled();editDay();}}
 }
 async function save(action){
  sync();if(!loaded||busy||!model?.canEdit)return;
  const gen=generation,id=key,entry=model.entries.find(e=>e.day===day());
  const input=action==='goal'?{action,goalKm:number(q('goal')),revision:model.settings.revision}:{action,day:day(),km:number(q('km')),restHours:number(q('rest')),note:q('note').value,revision:entry?.revision??0};
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
  const rows=mergeActivity(activityDates(model.from,model.to),model.entries,gps),url=URL.createObjectURL(new Blob([activityCsv(rows)],{type:'text/csv;charset=utf-8'}));
  const a=doc.createElement('a');a.href=url;a.download='Pejlo-motion-'+model.from+'-'+model.to+'.csv';doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 q('gps').onclick=async()=>{
  sync();if(!loaded||busy||!selected()?.trackerId)return;const gen=generation,id=key,identifier=selected().trackerId;busy=true;disabled();q('gps-status').textContent='Henter GPS-punkter for perioden…';
  try{
   const result=await request('tracker?'+new URLSearchParams({identifier,from:model.from,to:model.to}),undefined,55000);
   if(gen!==generation||context()!==id)return;
   if(result.historyAvailable===false||!Array.isArray(result.route))throw Error('GPS-historikken kunne ikke hentes.');
   const analysis=activityGps(result.route,selected().type);gps=analysis.days;render(false);
   q('gps-status').textContent='GPS-estimater er hentet. '+analysis.rejected+' forbindelser mellem punkter blev udeladt.'+(result.historyTruncated?' Ufuldstændigt: Traccars grænse på 10.000 punkter er nået.':'')+' Ro ved samme sted er ikke målt søvn eller hvile.';
  }catch(e){if(gen===generation){gps=[];render(false);q('gps-status').textContent=e.message;}}
  finally{if(gen===generation){busy=false;disabled();}}
 };
 clear();return {sync,load,clear};
}
