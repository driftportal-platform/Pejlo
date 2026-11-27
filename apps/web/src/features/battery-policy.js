export function batteryPolicySummary(policy,now=Date.now()){
 if(policy?.find_until>now){const seconds=Math.ceil((policy.find_until-now)/1000);return 'Find aktiv · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' tilbage · ønsket interval 30 sek.';}
 if(policy?.find_until||policy?.restore_pending)return 'Find afsluttet eller indstilling ændret · intervallet afventer tilbagevending.';
 return policy?.auto_enabled?'Automatisk interval er slået til':'Automatisk interval er slået fra';
}
export function createBatteryPolicy({root,selected,request,canEdit,updated,win=root?.ownerDocument?.defaultView,now=()=>Date.now()}){
 if(!root)return {clear(){},render(){}};
 const q=s=>root.querySelector(s);let generation=0,busy=false,enabled=false,model=null,dirty=false,key=null,timer=null,lastPoll=0,polling=false,error='';
 const notes={offline:'Trackeren er offline. Intervalændringen afventer forbindelse.',cooldown:'Afventer mindst ét minut mellem ændringer.',uncertain:'Afsendelsen er uafklaret. Kontrollér kommandolog og tracker før et nyt forsøg.',unsupported:'Trackeren understøtter ikke intervalkommandoen.',missing:'Trackeren blev ikke fundet.',error:'Serverkontrol mislykkedes. Der forsøges ved næste kontrol.',home:'Stabilt Wi-Fi-hjemmemønster: ønsket interval 120 sekunder.',learning:'Samler tre friske Wi-Fi-målinger over mindst to minutter. Ønsket interval 60 sekunder.',outside:'Wi-Fi-mønstret ligner ude: ønsket interval 60 sekunder.',unknown:'Wi-Fi er usikkert eller gammelt: ønsket interval 60 sekunder.',normal:'Det tidligere interval er sendt til Traccar.',manual:'Det manuelle interval er sendt til Traccar.',find:'Find-intervallet er sendt til Traccar.'};
 const visible=()=>!root.ownerDocument?.hidden&&(!root.getClientRects||root.getClientRects().length>0);
 function paint(){
  const p=model?.policy,active=p?.find_until>now(),pending=!!p?.find_until||!!p?.restore_pending;
  q('fieldset').disabled=busy||!enabled||!canEdit();
  if(!dirty)q('[data-battery-auto]').checked=!!p?.auto_enabled;
  q('[data-battery-auto-save]').disabled=!dirty;
  q('[data-battery-find]').disabled=active||pending;
  q('[data-battery-stop]').disabled=!active;
  const summary=q('[data-battery-policy-summary]');if(summary)summary.textContent=enabled?batteryPolicySummary(p,now()):'Intervalstyring er ikke tilgængelig for denne tracker.';
  const sendState=model?.last?.status;
  q('[data-battery-policy-status]').textContent=error||(!enabled?'Automatik er ikke tilgængelig for denne tracker.':!p?'Vælg automatik eller start en tidsbegrænset Find-periode.':(notes[p.note]||'Afventer næste kontrol på serveren.')+(sendState==='sent'?' Afsendelsen er registreret; trackerens interval er ikke læst tilbage.':sendState?' Seneste afsendelse: '+({pending:'afventer svar',rejected:'afvist',uncertain:'uafklaret'}[sendState]||'ukendt')+'.':'')+(dirty?' Du har en ændring, som ikke er gemt.':''));
 }
 function stopTimer(){if(timer!==null){win?.clearInterval(timer);timer=null;}}
 function clear(){generation++;stopTimer();busy=false;polling=false;enabled=false;model=null;dirty=false;key=null;error='';lastPoll=0;paint();}
 function render(result){
  const id=selected()?.trackerId;if(key!==id){generation++;dirty=false;key=id;error='';}
  enabled=result.enabled===true;model=result;paint();
  if(timer===null&&win)timer=win.setInterval(()=>{if(!visible())return;paint();if(now()-lastPoll>=15000)void refresh();},1000);
 }
 async function refresh(){
  const id=key;if(!id||busy||polling||!visible())return;const gen=generation;polling=true;lastPoll=now();
  try{const result=await request('battery?identifier='+encodeURIComponent(id));if(gen===generation&&selected()?.trackerId===id){error='';render(result);}}
  catch(e){if(gen===generation){error='Status kunne ikke opdateres: '+e.message;paint();}}
  finally{if(gen===generation)polling=false;}
 }
 async function send(input){
  const id=selected()?.trackerId;if(!id||busy||!enabled||!canEdit())return;
  const gen=++generation;polling=false;busy=true;error='';paint();
  try{const result=await request('battery',{identifier:id,...input});if(gen===generation&&selected()?.trackerId===id){if(input.action==='auto')dirty=false;lastPoll=now();updated(result);render(result);}}
  catch(e){if(gen===generation)error=e.message;}
  finally{if(gen===generation){busy=false;paint();}}
 }
 q('[data-battery-auto]').onchange=()=>{dirty=q('[data-battery-auto]').checked!==!!model?.policy?.auto_enabled;paint();};
 q('[data-battery-auto-save]').onclick=()=>send({action:'auto',enabled:q('[data-battery-auto]').checked,testConfirmed:true});
 q('[data-battery-find]').onclick=()=>send({action:'find',minutes:Number(q('[data-battery-find-minutes]').value)});
 q('[data-battery-stop]').onclick=()=>send({action:'stop'});
 clear();return {clear,render,refresh};
}
