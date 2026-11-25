import {animalType} from '../shared/activity.js';
const stamp=at=>new Date(at).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const duration=ms=>{const m=Math.max(0,Math.floor(ms/60000));return Math.floor(m/60)+' t '+m%60+' min';};
const reasons={manual:'Stoppet manuelt',movement:'Automatisk stop: troværdig GPS-bevægelse',charging:'Stoppet: opladning',removed:'Stoppet: trackeren er taget af'};
export function createRestSession({root,selected,request,data,notice,scope=()=>''}){
 const doc=root.ownerDocument,button=root.querySelector('[data-rest-toggle]'),status=root.querySelector('[data-rest-status]'),list=root.querySelector('[data-rest-log]');
 let key=null,generation=0,model=null,busy=false,loading=false,lastLoad=0,error='',startId=null;
 const context=()=>{const p=selected();return p?.trackerId&&animalType(p.type)?JSON.stringify([scope(),p.id,p.trackerId,p.type]):null;};
 const identity=()=>{const p=selected();return {identifier:p.trackerId,profileId:p.id,type:p.type};};
 function render(){
  if(!key){root.hidden=true;return;}root.hidden=false;
  const active=model?.active,p=selected(),d=data(),charging=d?.device?.identifier===p.trackerId&&d?.telemetry?.charging===true&&Date.now()-d.telemetry.receivedAt<=300000;
  button.textContent=busy?'Gemmer…':active?'Stop hvile':'Start hvile';button.setAttribute('aria-pressed',active?'true':'false');
  button.disabled=busy||loading||!model?.canEdit||(!active&&(p.attachment?.state!=='worn'||charging));
  button.className=active?'primary rest-session-active':'outline-button';
  status.textContent=error||(!model?'Henter hvilestatus…':active?'Manuelt startet '+stamp(active.startedAt)+' · '+duration(Date.now()-active.startedAt)+(Number.isFinite(active.lastFixAt)&&Date.now()-active.lastFixAt<=300000?' · Bevægelse kontrolleres.':' · Mangler friske GPS-målinger; automatisk stop afventer.'):
   charging?'Trackeren oplader. Start hvile, når den er på dyret igen.':p.attachment?.state!=='worn'?'Markér først trackeren som påsat under Indstillinger.':model.canEdit?'Tryk, når du ved, at '+p.name+' hviler.':'Du har læseadgang til hvileperioderne.');
 }
 function renderLog(){list.replaceChildren();for(const r of model?.history||[]){const line=doc.createElement('p');line.textContent=stamp(r.startedAt)+' → '+(r.endedAt===null?'I gang':stamp(r.endedAt))+' · '+duration((r.endedAt??Date.now())-r.startedAt)+' · '+(r.endedAt===null?'Manuelt startet':reasons[r.reason]||'Registreret hvile');list.append(line);}if(!model?.history?.length)list.textContent='Ingen registrerede hvileperioder endnu.';}
 function sync(){const next=context();if(next!==key){generation++;key=next;model=null;busy=false;loading=false;lastLoad=0;error='';startId=null;list.replaceChildren();}render();if(key&&!doc.hidden&&!loading&&!busy&&Date.now()-lastLoad>=15000)void load();}
 async function load(){if(!key||loading||busy)return;const gen=generation,expected=key;loading=true;lastLoad=Date.now();
  try{const result=await request('rest-session?'+new URLSearchParams(identity()));if(gen!==generation||context()!==expected)return;const prior=model?.active?.id;model=result;error='';renderLog();if(prior&&!result.active){notice('Hvileperioden er stoppet og gemt i loggen.');}}
  catch(e){if(gen===generation&&context()===expected)error='Hvilestatus kunne ikke hentes. '+e.message;}
  finally{if(gen===generation&&context()===expected){loading=false;render();}}
 }
 async function toggle(){sync();if(busy||loading||!model?.canEdit)return;const gen=generation,expected=key,active=model.active;if(!active&&!startId)startId=crypto.randomUUID();busy=true;error='';render();
  try{const result=await request('rest-session',{...identity(),action:active?'stop':'start',id:active?.id||startId});if(gen!==generation||context()!==expected)return;model=result;startId=null;lastLoad=Date.now();renderLog();notice(active?'Hvileperioden er gemt.':'Hvile startet manuelt.');}
  catch(e){if(gen===generation&&context()===expected){error=e.message;lastLoad=0;}}
  finally{if(gen===generation&&context()===expected){busy=false;render();}}
 }
 button.onclick=()=>void toggle();
 return {sync,tick(){sync();},clear(){generation++;key=null;model=null;busy=false;loading=false;startId=null;list.replaceChildren();root.hidden=true;}};
}
