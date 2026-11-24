import {createWifiSetup,wifiSetupQuality} from '../shared/wifi-setup.js';
import {cleanWifiConfig,wifiObservation} from '../shared/home-wifi.js';

export function createWifiSetupGuide({root,selected,data,canEdit,ready,scope=()=>'',save,notice,now=Date.now,doc=root.ownerDocument}){
 const q=s=>root.querySelector('[data-wifi-setup-'+s+']');
 let key=null,session=null,busy=false,generation=0,expected='',savedInside=false,done=false,error='',message='',started=0;
 const context=()=>{const p=selected();return p?.trackerId?JSON.stringify([scope(),p.id,p.trackerId]):null;};
 const signature=()=>JSON.stringify(cleanWifiConfig(selected()?.homeWifi));
 function clear(){generation++;key=null;session=null;busy=false;savedInside=false;done=false;error='';message='';q('list').replaceChildren();}
 async function commit(){
  if(busy||!session||!ready()||!canEdit()||context()!==key)return;
  const gen=generation,id=key,next=session.configuration();busy=true;error='';render();
  try{
   await save(next,{profileId:selected().id,trackerId:selected().trackerId,expected});
   if(gen!==generation||context()!==id)return;
   expected=JSON.stringify(next);savedInside=true;done=session.snapshot().phase==='done';
   if(done)notice('Wi-Fi-opsætningen er gemt.');
  }catch(e){if(gen===generation)error=e.message||'Målingerne kunne ikke gemmes. Prøv igen.';}
  finally{if(gen===generation){busy=false;render();}}
 }
 function render(){
  const available=!!key&&canEdit()&&ready()&&!busy,view=session?.snapshot(),config=cleanWifiConfig(selected()?.homeWifi);
  q('start').disabled=!available||!!session&&!done;
  q('start').textContent=config.samples.length?'Start ny inde/ude-opsætning':'Start – trackeren er inde';
  q('resume').hidden=!!session||config.samples.filter(s=>s.label==='inside').length<3||config.samples.filter(s=>s.label==='outside').length>=3;
  q('resume').disabled=!available;
  q('outside').hidden=!view||view.phase!=='inside-ready'||!savedInside;
  q('outside').disabled=!available;
  q('cancel').hidden=!session||done;q('cancel').disabled=busy;
  q('confirm').hidden=view?.phase!=='choose';q('confirm').disabled=!available;
  q('retry').hidden=!error;q('retry').disabled=!available;
  q('choices').hidden=view?.phase!=='choose';
  q('progress').textContent=session?'Inde: '+view.inside.length+' af 3 · Ude: '+view.outside.length+' af 3':config.samples.length?'Gemt: '+config.samples.filter(s=>s.label==='inside').length+' målinger inde · '+config.samples.filter(s=>s.label==='outside').length+' ude':'Guiden gemmer tre nye målinger inde og tre ude for dig.';
  let text=message||'Læg trackeren inde, start guiden og flyt den gerne mellem et par rum. Hold appen åben.';
  if(!key)text='Forbind og gem en tracker på profilen først.';
  else if(!canEdit())text='Du har kun læseadgang til denne profil.';
  else if(!session&&!ready())text='Afvent profildata, og gem eventuelle ændringer, før du starter.';
  else if(busy)text='Gemmer Wi-Fi-målingerne…';
  else if(error)text=error+' Målingerne bevares her. Tryk Prøv gemning igen.';
  else if(done)text=wifiSetupQuality(config)==='distinct'?'Opsætningen er gemt. Målingerne viser forskellige inde/ude-mønstre. Vurderingen er vejledende; batteriautomatik aktiveres særskilt under Tracker.':'Målingerne er gemt, men inde- og udemønstrene kan endnu ikke skelnes tydeligt. Prøv en ny opsætning med et andet sted udenfor. Usikre signaler giver ingen hjemmekonklusion.';
  else if(session){
   if(!ready())text='Gem først øvrige profilændringer. Guiden holder pause imens.';
   else if(doc.hidden)text='Åbn appen igen for at fortsætte indsamlingen.';
   else if(view.phase==='choose')text='Bekræft hjemmets punkter én gang. Gentagne, tydelige punkter er foreslået; kontrollér valget, da naboers net også kan optræde.';
   else if(view.phase==='inside-ready')text=savedInside?'Indemålingerne er gemt. Flyt trackeren udenfor nær hjemmet, og tryk Trackeren er nu ude.':'Tre indemålinger er klar til automatisk gemning.';
   else if(now()-started>15*60000)text='Ingen færdig måleserie efter 15 minutter. Stop og prøv igen, når trackeren sender Wi-Fi-data. Allerede gemte målinger bevares.';
   else{
    const o=wifiObservation(data(),{macs:view.macs},now());
    text=data()?.device?.status!=='online'?'Afventer forbindelse til trackeren.':!o.fresh||!o.all.length||o.at<view.startedAt?'Afventer en ny Wi-Fi-scanning fra trackeren. GPS- og mobilkontakt kan godt være friske samtidig.':view.confirmed&&!o.points.length?'En Wi-Fi-scanning er modtaget, men ingen af hjemmets valgte punkter var med. Flyt tættere på huset.':'Samler automatisk nye målinger '+(view.phase==='inside'?'inde':'ude')+'. Flyt gerne trackeren lidt mellem målingerne.';
   }
  }
  q('status').textContent=text;
 }
 function update(){
  const nextKey=context();if(nextKey!==key){clear();key=nextKey;}
  if(session&&!busy&&(!canEdit()||signature()!==expected)){
   clear();key=nextKey;message='Profilens Wi-Fi eller adgang er ændret. Start guiden igen med de gemte indstillinger.';
  }
  if(session&&!busy&&!done&&!error&&ready()&&canEdit()&&!doc.hidden&&now()-started<=15*60000){
   session.observe(data(),now());
   const phase=session.snapshot().phase;
   if(phase==='choose'&&!q('list').children.length){
    let suggested=0;
    for(const p of session.candidates()){
     const label=doc.createElement('label'),box=doc.createElement('input'),span=doc.createElement('span');box.type='checkbox';box.value=p.mac;
     box.checked=p.recommended&&suggested++<3;span.textContent=p.mac+' · '+p.rssi+' dBm · set '+p.seen+' gange';label.className='wifi-candidate';label.append(box,span);q('list').append(label);
    }
   }
   if(phase==='done'||phase==='inside-ready'&&!savedInside){void commit();return;}
  }
  render();
 }
 function start(resume=false){
  update();if(!key||!canEdit()||!ready()||busy)return;
  generation++;session=createWifiSetup(selected().homeWifi,now(),resume);expected=signature();started=now();savedInside=resume;done=false;error='';message='';q('list').replaceChildren();update();
 }
 q('start').onclick=()=>start(false);q('resume').onclick=()=>start(true);
 q('outside').onclick=()=>{update();if(!session||!savedInside||busy||!ready()||!canEdit())return;session.startOutside(now());started=now();update();};
 q('confirm').onclick=()=>{
  update();if(!session||busy||!ready()||!canEdit())return;
  try{session.choose([...q('list').querySelectorAll('input')].filter(e=>e.checked).map(e=>e.value));update();}catch(e){notice(e.message);}
 };
 q('cancel').onclick=()=>{if(busy)return;clear();key=context();message='Opsætning stoppet. Allerede gemte Wi-Fi-målinger er bevaret.';render();};
 q('retry').onclick=()=>{update();if(error)void commit();};
 clear();return {update,clear};
}
