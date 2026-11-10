import {directionsURL} from './handoff.js';
export function createAlarmArchive({request,selected}){
 const $=s=>document.querySelector(s);let generation=0,next=null;
 function clear(){generation++;next=null;$('#alarm-list').replaceChildren();$('#alarm-handoff-list').replaceChildren();$('#alarm-handoffs').hidden=true;$('#alarm-status').textContent='';$('#alarms-more').hidden=true;}
 async function load(more=false){
  const p=selected();if(!more)clear();if(!p?.trackerId){$('#alarm-status').textContent='Tilknyt en tracker for at se alarmer.';return;}
  const gen=generation,id=p.id;$('#alarm-status').textContent='Henter alarmarkiv…';
  try{
   const value=await request('alarms?'+new URLSearchParams({identifier:p.trackerId,...(more&&next?next:{})}));if(gen!==generation||selected()?.id!==id)return;
   const labels={snoozed:'Beskeder var sat på pause',pending:'Afventer push',accepted:'Afleveret til push-tjenesten',retrying:'Push forsøges igen',failed:'Push kunne ikke afleveres',quiet:'Push undertrykt i stilleperiode',disabled:'Denne push-type var slået fra',unconfigured:'Push var ikke sat op',expired:'Push udløbet',suppressed:'Push undertrykt', 'no-device':'Ingen tilmeldt pushenhed'};
   for(const event of value.events){const el=document.createElement('article');el.className='alarm-item';const title=document.createElement('p'),details=document.createElement('p');title.textContent=event.payload.body;details.className='hint';details.textContent='Registreret '+new Date(event.created_at).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen'})+' · '+(labels[event.push_status]||event.push_status)+(event.area?.name?' · Område: '+event.area.name:'');el.append(title,details);$('#alarm-list').append(el);}
   if(!more&&value.handoffs?.length){
    $('#alarm-handoffs').hidden=false;
    for(const handoff of value.handoffs){
     const row=document.createElement('p');
     row.textContent=handoff.name+' tog alarmen '+new Date(handoff.startedAt).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen'})+'.';
     const url=directionsURL(handoff.position);
     if(url){
      const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent='Find vej til positionen ved pausen';row.append(' ',link);
     }
     $('#alarm-handoff-list').append(row);
    }
   }
   next=value.next;$('#alarms-more').hidden=!next;$('#alarm-status').textContent=$('#alarm-list').children.length?'Viser registrerede hændelser fra de seneste 90 dage.':'Ingen registrerede hændelser endnu. Arkivet starter fra denne opdatering.';
  }catch(e){if(gen===generation)$('#alarm-status').textContent=e.message;}
 }
 $('#alarms-reload').onclick=()=>load();$('#alarms-more').onclick=()=>load(true);return{load,clear};
}
