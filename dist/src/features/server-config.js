export function createServerConfig({request}){
 const $=id=>document.getElementById(id);
 let enabled=false,generation=0,revision=null,tested=null,canSave=false,busy=false;
 const values=()=>({url:$('server-url').value.trim(),token:$('server-token').value.trim()});
 function refresh(){ $('server-activate').disabled=!enabled||busy||!canSave||!tested||JSON.stringify(values())!==tested; }
 function clearTest(){tested=null;$('server-devices').replaceChildren();refresh();}
 async function reload(){
  const g=generation;busy=true;refresh();
  try{const r=await request('admin/server');if(g!==generation)return;
   revision=r.revision;canSave=r.canSave;$('server-url').value=r.url||'';
   $('server-current').textContent='Aktiv server: '+(r.url||'Ikke konfigureret')+' · '+(r.source==='admin'?'Valgt i admin':'Cloudflare-opsætning');
   $('server-message').textContent=r.canSave?'Test den ønskede server før aktivering.':'For at gemme: Tilføj Cloudflare Secret TRACCAR_CONFIG_SECRET med mindst 32 tilfældige tegn. Behold samme hemmelighed efter opsætning.';
   clearTest();
  }catch(e){if(g===generation)$('server-message').textContent=e.message;}
  finally{if(g===generation){busy=false;refresh();}}
 }
 async function submit(action){
  if(busy||!enabled)return;
  const input=values();if(action==='activate'&&JSON.stringify(input)!==tested)return;
  const g=generation;busy=true;refresh();$('server-test').disabled=true;$('server-reload').disabled=true;
  try{const r=await request('admin/server',{...input,action,revision});if(g!==generation)return;
   $('server-devices').replaceChildren();
   for(const d of r.devices||[]){const li=document.createElement('li');li.textContent=d.name+' · '+d.identifier;$('server-devices').append(li);}
   if(action==='test'){
    tested=r.missing.length?null:JSON.stringify(input);
    $('server-message').textContent=r.missing.length?'Forbindelsen virker, men disse tilknyttede trackere mangler: '+r.missing.join(', '):'Forbindelsen virker. '+r.devices.length+' trackere fundet.'+(canSave?' Du kan nu aktivere serveren.':' Tilføj TRACCAR_CONFIG_SECRET før aktivering.');
   }else{
    $('server-token').value='';tested=null;await reload();
    if(g===generation)$('server-message').textContent='Serveren er aktiveret for app og baggrundsalarmer. Tidligere serveres GPS-filter genbruges ikke.';
   }
  }catch(e){if(g===generation){tested=null;$('server-message').textContent=e.message;}}
  finally{if(g===generation){busy=false;$('server-test').disabled=false;$('server-reload').disabled=false;refresh();}}
 }
 $('server-form').onsubmit=e=>{e.preventDefault();submit('test');};
 $('server-activate').onclick=()=>submit('activate');
 $('server-reload').onclick=()=>{if(!busy)reload();};
 for(const id of ['server-url','server-token'])$(id).oninput=clearTest;
 return {enable(value){generation++;enabled=value;busy=false;tested=null;revision=null;canSave=false;
  $('traccar-server-panel').hidden=!value;$('server-token').value='';$('server-url').value='';$('server-current').textContent='';$('server-message').textContent='';$('server-devices').replaceChildren();$('server-test').disabled=false;$('server-reload').disabled=false;refresh();if(value)reload();
 }};
}
