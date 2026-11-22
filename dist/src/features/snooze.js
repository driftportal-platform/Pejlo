export function createSnooze({request,selected,notice=()=>{}}){
 const $=s=>document.querySelector(s);let identifier=null,until=0,offset=0,generation=0,busy=false,ready=false;
 function paused(){return until>Date.now()+offset;}
 function render(){
  const remaining=Math.max(0,until-Date.now()-offset);$('#snooze-status').textContent=!identifier?'Vælg en profil med en tracker.':!ready?'Pause-status er ikke hentet.':remaining?'Dine beskeder for '+(selected()?.name||'denne profil')+' er på pause i '+Math.ceil(remaining/60000)+' min. · indtil '+new Date(until).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen'})+'.':'Dine beskeder er ikke på pause.';
  $('#confirm-pause').disabled=!identifier||!ready||busy;
  for(const button of document.querySelectorAll('[data-snooze]'))button.disabled=!identifier||!ready||busy||(button.dataset.snooze==='0'&&!remaining);
 }
 function clear(){generation++;identifier=null;until=0;offset=0;ready=false;busy=false;render();}
 async function load(force=false){
  const id=selected()?.trackerId||null;if(busy&&id===identifier)return;if(!force&&id===identifier)return;const changed=id!==identifier,gen=++generation;identifier=id;if(changed){until=0;ready=false;busy=false;}render();if(!id)return;
  try{const value=await request('snooze?identifier='+encodeURIComponent(id));if(gen!==generation)return;until=value.until;offset=value.serverTime-Date.now();ready=true;render();}
  catch(e){if(gen===generation){ready=false;render();$('#snooze-status').textContent=e.message;}}
 }
 async function set(hours){
  const id=selected()?.trackerId;if(!id||!ready||busy)return;const gen=++generation;busy=true;render();
  try{const value=await request('snooze',{identifier:id,hours});if(gen!==generation)return;until=value.until;offset=value.serverTime-Date.now();render();$('#pause-action').hidden=true;notice(hours?'Dine beskeder er sat på pause.':'Dine beskeder er genoptaget.');}
  catch(e){if(gen===generation)notice(e.message);}
  finally{if(gen===generation){busy=false;render();}}
 }
 for(const button of document.querySelectorAll('[data-snooze]'))button.onclick=()=>set(Number(button.dataset.snooze));
 $('#confirm-pause').onclick=()=>set(1);$('#cancel-pause').onclick=()=>$('#pause-action').hidden=true;
 return {load,clear,paused,tick:render};
}
