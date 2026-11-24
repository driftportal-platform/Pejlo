export function createBatteryPolicy({root,selected,request,canEdit,updated}){
 if(!root)return {clear(){},render(){}};
 const q=s=>root.querySelector(s);let generation=0,busy=false,enabled=false;
 const notes={offline:'Trackeren er offline. Tilbagevending afventer forbindelse.',cooldown:'Afventer mindst ét minut mellem ændringer.',uncertain:'Afsendelsen er uafklaret. Kontrollér intervallet i Traccar før et nyt manuelt ønske.',unsupported:'Intervalkommandoen kunne ikke bruges.',missing:'Trackeren blev ikke fundet.',error:'Serveren kunne ikke kontrollere trackeren. Nyt forsøg ved næste kontrol.',home:'Wi-Fi-mønstret ligner hjemme. Senest ønsket: 120 sekunder.',learning:'Samler friske Wi-Fi-målinger før skift til 120 sekunder.',outside:'Wi-Fi-mønstret ligner ude. Senest ønsket: 60 sekunder.',unknown:'Wi-Fi-vurderingen er usikker eller gammel. Senest ønsket: 60 sekunder.',normal:'Tilbagevending til det tidligere interval er behandlet.',find:'Find-intervallet er behandlet.'};
 function lock(){q('fieldset').disabled=busy||!enabled||!canEdit();}
 function clear(){generation++;busy=false;enabled=false;lock();q('[data-battery-auto]').checked=false;q('[data-battery-policy-status]').textContent='Vælg en tilknyttet tracker.';}
 function render(result){
  enabled=result.enabled===true;lock();const p=result.policy;
  q('[data-battery-auto]').checked=!!p?.auto_enabled;
  const active=p?.find_until>Date.now();
  q('[data-battery-stop]').disabled=!p?.find_until&&!p?.restore_pending;
  q('[data-battery-policy-status]').textContent=!enabled?'Automatik er ikke tilgængelig for denne tracker.':!p?'Automatik er slået fra.':(active?'Find ønsket frem til '+new Date(p.find_until).toLocaleTimeString('da-DK',{timeZone:'Europe/Copenhagen',hour:'2-digit',minute:'2-digit'})+'. ':p.find_until||p.restore_pending?'Afventer tilbagevending til normalt interval. ':'')+(p.auto_enabled?'Automatik slået til. ':'Automatik slået fra. ')+(notes[p.note]||'Afventer næste kontrol på serveren.');
 }
 async function send(input){
  const id=selected()?.trackerId;if(!id||busy||!enabled||!canEdit())return;
  const gen=generation;busy=true;lock();
  try{const result=await request('battery',{identifier:id,...input});if(gen===generation&&selected()?.trackerId===id)updated(result);}
  catch(e){if(gen===generation)q('[data-battery-policy-status]').textContent=e.message;}
  finally{if(gen===generation){busy=false;lock();}}
 }
 q('[data-battery-auto-save]').onclick=()=>{
  const on=q('[data-battery-auto]').checked;
  if(on&&!confirm('Afprøv automatisk 120 sekunder ved et stabilt hjemmemønster og 60 sekunder ved usikkerhed eller ude. Skal automatikken køre, også når appen er lukket?'))return;
  return send({action:'auto',enabled:on,testConfirmed:on});
 };
 q('[data-battery-find]').onclick=()=>send({action:'find',minutes:Number(q('[data-battery-find-minutes]').value)});
 q('[data-battery-stop]').onclick=()=>send({action:'stop'});
 clear();return {clear,render};
}
