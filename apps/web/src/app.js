import {startAuthentication} from './features/auth.js';
import {createCloudState} from './features/cloud-state.js';
import {emptyState,normalizeAccountState} from './features/account-state.js';
import {icon} from './components/icons.js';
import {types,newProfile,profileSubtitle} from './features/profiles.js';
import {loadState} from './features/storage.js';
import {demoFor} from './features/demo.js';
import {createMap,layers} from './features/maps.js';
import {createLocation} from './features/location.js';
import {distance,formatDistance,bearing,relativeBearing,directionName} from './shared/geo.js';
const $=s=>document.querySelector(s);
const state=emptyState();
let saveCloud=null,cloud=null,sessionGeneration=0;
let currentPage='kort', overviewMap, searchMap, chosenLayer='demo', choosingHome=false, user=null, heading=null, headingTime=0, watching=false, simulation=false, demoStep=0, toastTimer;
const selected=()=>state.profiles.find(p=>p.id===state.activeId);
const data=()=>selected()?demoFor(selected()):null;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),6000);}
function persist(){
 const gen=sessionGeneration;
 if(!saveCloud){toast('Kontoen er ikke klar. Genindlæs forbindelsen.');return;}
 saveCloud(structuredClone(state)).catch(e=>{if(gen===sessionGeneration)toast(e.code==='pejlo/conflict'?e.message:'Ændringen blev ikke gemt. Kontrollér forbindelsen, og prøv igen.');});
}
function options(select,items,value){select.replaceChildren();for(const [id,label] of items){const o=document.createElement('option');o.value=id;o.textContent=label;select.append(o);}select.value=value;}
function renderMap(m){if(!selected())return;m?.profile(selected(),data(),{showRoute:$('#show-route').checked,showHome:$('#show-home').checked});}
function showPage(name){
  if(!selected()){name='velkommen';}
  else if(!['kort','ture','indstillinger','soeg'].includes(name))name='kort';
  if(currentPage==='soeg'&&name!=='soeg')stopLocation(false);
  currentPage=name;
  document.querySelectorAll('.page').forEach(e=>e.hidden=e.id!==name);
  document.querySelectorAll('nav button').forEach(e=>e.classList.toggle('active',e.dataset.page===name||(name==='soeg'&&e.dataset.page==='kort')));
  $('#page-title').textContent={kort:'Dit overblik',ture:'Ture og bevægelser',indstillinger:'Dine profiler og indstillinger',soeg:'Find '+(selected()?.name??''),velkommen:'Velkommen til Pejlo'}[name];
  if(name==='kort')requestAnimationFrame(()=>overviewMap?.fit(selected(),data()));
  if(name==='soeg')requestAnimationFrame(()=>{if(!searchMap){searchMap=createMap('search-map',{notice:toast,onManual:()=>{$('#autozoom').checked=false;}});searchMap?.layer(chosenLayer,state.mapKey);}renderMap(searchMap);searchMap?.fit(selected(),data());updateSearch();});
}
function go(name){window.location.hash=name;showPage(name);}
function refresh(){
  const empty=!selected();
  $('.profile-bar').hidden=empty;$('.demo-banner').hidden=empty;$('.pet').hidden=empty;
  document.querySelectorAll('nav button').forEach(b=>b.disabled=empty);
  if(empty){options($('#profile-select'),[],null);$('#side-name').textContent='';$('#side-type').textContent='';$('#timeline').replaceChildren();for(const id of ['status-title','history-title','search-title'])$('#'+id).textContent='';for(const id of ['profile-name','profile-device','lat','lon','radius','map-key'])$('#'+id).value='';showPage('velkommen');return;}
  if(currentPage==='velkommen')currentPage='kort';
  const p=selected(),d=data(),meta=types[p.type];
  options($('#profile-select'),state.profiles.map(p=>[p.id,p.name+' · '+types[p.type].label]),p.id);
  $('#side-name').textContent=p.name;$('#side-type').textContent=meta.label;
  $('#side-icon').innerHTML=icon(meta.icon,30);$('#select-icon').innerHTML=icon(meta.icon,22);
  $('#status-title').textContent=p.name+' · eksempelposition';
  $('#find').replaceChildren();$('#find').insertAdjacentHTML('beforeend',icon('find'));$('#find').append(document.createTextNode('Find '+p.name));
  $('#home-distance').textContent=formatDistance(distance(p.home,d.position));
  $('#home-title').textContent=meta.noun;
  $('#profile-name').value=p.name;$('#profile-type').value=p.type;$('#profile-device').value=p.deviceLabel;
  $('#lat').value=p.home.lat;$('#lon').value=p.home.lon;$('#radius').value=p.home.radius;
  $('#map-key').value=state.mapKey;
  $('#delete-profile').hidden=false;
  $('#profile-context').textContent=meta.category==='dyr'?'Hjemmeområde og ture for '+p.name+'.':'Fast udgangspunkt og bevægelser for '+p.name+'.';
  $('#history-title').textContent='Eksempelrute for '+p.name;
  $('#search-title').textContent='Find '+p.name;
  $('#trip-distance').textContent=formatDistance(d.route.slice(1).reduce((n,v,i)=>n+distance(d.route[i],v),0));
  $('#timeline').replaceChildren();d.route.forEach((v,i)=>{const row=document.createElement('div');row.className='timeline-item';const title=document.createElement('span');title.textContent=i===0?'Første eksempelpunkt':i===d.route.length-1?'Seneste eksempelpunkt':'Punkt '+(i+1);const dist=document.createElement('span');dist.textContent=formatDistance(distance(p.home,v))+' fra fast udgangspunkt';row.append(title,dist);$('#timeline').append(row);});
  $('#navigate').href=`https://www.google.com/maps/search/?api=1&query=${d.position.lat},${d.position.lon}`;
  renderMap(overviewMap);renderMap(searchMap);updateAge();updateSearch();showPage(currentPage);
}
function updateAge(){if(!selected())return;const seconds=Math.max(0,Math.floor((Date.now()-data().position.timestamp)/1000));const text=seconds<60?seconds+' sek. siden':Math.floor(seconds/60)+' min. siden';$('#age').textContent=text;$('#freshness').textContent=seconds>300?'Gammel eksempelposition':'Eksempel';$('#search-age').textContent=(seconds>300?'OBS: gammel position. ':'')+'Målet er en eksempelposition fra '+text+'.';}
function updateSearch(){
  if(!selected())return;
  const target=data().position;
  if(!user){$('#search-distance').textContent='— m';$('#direction-text').textContent='Start placering for at se afstand og retning.';$('#compass-arrow').style.opacity='.25';searchMap?.clearPhone();return;}
  const meters=distance(user,target),b=bearing(user,target),phoneStale=Date.now()-user.timestamp>20000;
  const hasHeading=heading!==null&&Date.now()-headingTime<10000&&!simulation;
  $('#search-distance').textContent=formatDistance(meters);
  const near=meters<=Math.max(user.accuracy,15);
  $('#direction-text').textContent=phoneStale?'Din placering er gammel. Vent på et nyt GPS-punkt.':near?'Tæt på eksempelpunktet. Afstanden er inden for mobilens GPS-usikkerhed.':Math.round(b)+'° mod '+directionName(b)+' · i fugleflugtslinje';
  $('#compass-mode').textContent=hasHeading?'I forhold til mobilen':'Nord op · ikke mobilens retning';
  $('#compass-arrow').style.transform=`rotate(${hasHeading?relativeBearing(b,heading):b}deg)`;$('#compass-arrow').style.opacity=near||phoneStale?'.25':'1';
  $('#phone-state').textContent=(simulation?'SIMULERET mobilposition':'Din mobilposition')+' · usikkerhed ca. '+Math.round(user.accuracy)+' m'+(phoneStale?' · forældet':'');
  $('#phone-state').classList.toggle('simulated',simulation);
  if(currentPage==='soeg')searchMap?.search(user,target,$('#autozoom').checked&&!phoneStale);
}
function stopLocation(announce=true){location.stop();watching=false;user=null;heading=null;simulation=false;$('#closer').hidden=true;$('#locate').textContent='Brug min placering';$('#phone-state').textContent='Placering er stoppet. Tryk Brug min placering for at fortsætte.';$('#phone-state').classList.remove('simulated');$('#compass-mode').textContent='Nord op';updateSearch();if(announce)toast('Placering og kompas er stoppet.');}
const location=createLocation(p=>{user=p;simulation=false;updateSearch();},message=>toast(message),h=>{heading=h;headingTime=Date.now();updateSearch();});
for(const b of document.querySelectorAll('nav button')){b.innerHTML=icon(b.dataset.page)+{kort:'Kort',ture:'Ture',indstillinger:'Indstillinger'}[b.dataset.page];b.onclick=()=>go(b.dataset.page);}
for(const e of document.querySelectorAll('[data-icon]'))e.innerHTML=icon(e.dataset.icon);
for(const b of document.querySelectorAll('[data-goto]'))b.onclick=()=>go(b.dataset.goto);
for(const id of ['profile-type','new-type'])options($('#'+id),[...(id==='new-type'?[['','Vælg dyr eller genstand…']]:[]),...Object.entries(types).map(([id,t])=>[id,t.label])],id==='new-type'?'':'cat');
for(const select of document.querySelectorAll('.layer-select')){options(select,Object.entries(layers),'demo');select.onchange=async()=>{
  const name=select.value;const ok=await overviewMap?.layer(name,state.mapKey);
  if(ok){chosenLayer=name;await searchMap?.layer(name,state.mapKey);document.querySelectorAll('.map-caption').forEach(e=>e.textContent=name==='demo'?'SKEMATISK EKSEMPEL · IKKE GEOGRAFISK KORT':'GEOGRAFISK KORT · POSITIONER ER EKSEMPLER');}
  document.querySelectorAll('.layer-select').forEach(s=>s.value=chosenLayer);
};}
overviewMap=createMap('map',{notice:toast,onHome:p=>{if(!choosingHome)return;choosingHome=false;$('#set-map-home').textContent='Sæt fast udgangspunkt';if(confirm('Gem dette som fast udgangspunkt for '+selected().name+'? På eksempelkortet svarer vejene ikke til virkeligheden.')){selected().home={...selected().home,...p};persist();refresh();toast('Fast udgangspunkt gemt.');}}});
$('#profile-select').onchange=e=>{stopLocation(false);state.activeId=e.target.value;persist();refresh();};
$('#fit').onclick=()=>{if(selected())overviewMap?.fit(selected(),data());};
$('#find').onclick=()=>go('soeg');
$('#show-route').onchange=()=>{renderMap(overviewMap);renderMap(searchMap);};$('#show-home').onchange=$('#show-route').onchange;
$('#set-map-home').onclick=()=>{choosingHome=!choosingHome;$('#set-map-home').textContent=choosingHome?'Annuller valg':'Sæt fast udgangspunkt';if(choosingHome)toast('Tryk på kortet. Eksempelkortets veje er skematiske — brug et geografisk kort eller koordinater til dit rigtige hjem.');};
$('#profile-form').onsubmit=e=>{e.preventDefault();const name=$('#profile-name').value.trim();if(!name)return toast('Skriv et navn.');Object.assign(selected(),{name,type:$('#profile-type').value,deviceLabel:$('#profile-device').value.trim()});persist();refresh();toast('Profil gemt. Navn og ikon er opdateret.');};
$('#home-form').onsubmit=e=>{e.preventDefault();if(!e.target.reportValidity())return;selected().home={lat:Number($('#lat').value),lon:Number($('#lon').value),radius:Number($('#radius').value)};persist();refresh();toast('Fast udgangspunkt gemt for '+selected().name+'.');};
$('#use-location').onclick=()=>{if(!navigator.geolocation)return toast('Placering er ikke tilgængelig.');navigator.geolocation.getCurrentPosition(p=>{$('#lat').value=p.coords.latitude.toFixed(6);$('#lon').value=p.coords.longitude.toFixed(6);toast('Kontrollér koordinaterne, og tryk Gem fast udgangspunkt.');},()=>toast('Placering kunne ikke hentes. Kontrollér browserens tilladelse.'),{enableHighAccuracy:true,timeout:15000,maximumAge:10000});};
function openNewProfile(){if(state.profiles.length>=50)return toast('Prototypen har plads til 50 profiler.');$('#new-profile-form').reset();$('#new-type').value='';$('#new-profile').showModal();}
$('#add-profile').onclick=openNewProfile;$('#first-profile').onclick=openNewProfile;$('#close-new').onclick=()=>$('#new-profile').close();
$('#new-profile-form').onsubmit=e=>{e.preventDefault();const p=newProfile($('#new-name').value.trim(),$('#new-type').value,$('#new-device').value.trim());if(!p)return toast('Vælg type, og skriv et navn.');stopLocation(false);state.profiles.push(p);state.activeId=p.id;persist();$('#new-profile').close();refresh();toast('Profil oprettet med eksempeldata.');};
$('#delete-profile').onclick=()=>{if(!selected())return;if(!confirm('Fjern profilen '+selected().name+'? Dette sletter ikke en fysisk tracker.'))return;stopLocation(false);state.profiles=state.profiles.filter(p=>p.id!==state.activeId);state.activeId=state.profiles[0]?.id??null;persist();refresh();};
$('#map-key-form').onsubmit=e=>{e.preventDefault();state.mapKey=$('#map-key').value.trim();persist();if(!state.mapKey){chosenLayer='demo';overviewMap?.layer('demo');searchMap?.layer('demo');document.querySelectorAll('.layer-select').forEach(s=>s.value='demo');document.querySelectorAll('.map-caption').forEach(e=>e.textContent='SKEMATISK EKSEMPEL · IKKE GEOGRAFISK KORT');}toast('Kortnøgle gemt på din konto. Vælg et kortlag på kortet.');};
$('#locate').onclick=()=>{stopLocation(false);watching=true;$('#phone-state').textContent='Venter på mobilens placering…';$('#locate').textContent='Start placering igen';location.start();};
$('#enable-compass').onclick=async()=>{if(await location.compass())toast('Kompas startet. Afventer en brugbar kompasretning fra mobilen.');};
$('#stop-location').onclick=()=>stopLocation();$('#autozoom').onchange=updateSearch;
function simulate(){location.stop();watching=false;simulation=true;heading=null;const meters=[600,300,150,70,25,8][Math.min(demoStep,5)],target=data().position;user={lat:target.lat-meters/111195,lon:target.lon,accuracy:8,timestamp:Date.now()};$('#closer').hidden=false;$('#closer').disabled=demoStep>=5;$('#phone-state').classList.add('simulated');updateSearch();}
$('#simulate').onclick=()=>{demoStep=0;simulate();};$('#closer').onclick=()=>{demoStep++;simulate();};
window.addEventListener('hashchange',()=>showPage(window.location.hash.slice(1)));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(watching||simulation||heading!==null))stopLocation(false);});
window.addEventListener('pagehide',()=>location.stop());
refresh();showPage(window.location.hash.slice(1));setInterval(()=>{updateAge();if(currentPage==='soeg')updateSearch();},1000);

const importLocal=()=>{
 const old=loadState();if(!old.profiles.length)return toast('Der er ingen gamle lokale profiler at importere.');
 if(!confirm('Importér '+old.profiles.length+' lokale profiler til den konto, du er logget ind på?'))return;
 const ids=new Set(state.profiles.map(p=>p.id));state.profiles.push(...old.profiles.filter(p=>!ids.has(p.id)).slice(0,50-state.profiles.length));state.activeId=state.profiles[0]?.id??null;persist();refresh();
};
$('#import-local').onclick=importLocal;$('#import-first').onclick=importLocal;
let slowTimer;
startAuthentication(async(user,{db,dbSDK,auth})=>{
 const gen=++sessionGeneration;clearTimeout(slowTimer);cloud?.close();saveCloud=null;stopLocation(false);overviewMap?.clear();searchMap?.clear();overviewMap?.layer('demo');searchMap?.layer('demo');chosenLayer='demo';choosingHome=false;$('#set-map-home').textContent='Sæt fast udgangspunkt';document.querySelectorAll('.layer-select').forEach(s=>s.value='demo');document.querySelectorAll('.map-caption').forEach(e=>e.textContent='SKEMATISK EKSEMPEL · IKKE GEOGRAFISK KORT');$('#new-profile').close();Object.assign(state,emptyState());refresh();
 if(!user?.emailVerified)return;
 $('#sync-state').textContent='Forbinder…';$('.app').inert=true;$('#cloud-help').textContent='Opretter forbindelse til dine private profiler…';
 const fail=()=>{if(gen!==sessionGeneration)return;clearTimeout(slowTimer);$('.app').hidden=true;$('#auth-shell').hidden=false;$('#cloud-help').textContent='Profillagring kunne ikke åbnes. Kontrollér, at Firestore-databasen og reglerne fra pakken er oprettet. Derefter: Prøv forbindelsen igen.';$('#sync-state').textContent='Ingen forbindelse';};
 slowTimer=setTimeout(fail,15000);
 cloud=createCloudState({
  ref:uid=>dbSDK.doc(db,'users',uid,'private','state'),
  listen:(ref,ok,error)=>dbSDK.onSnapshot(ref,{includeMetadataChanges:true},snap=>ok({fromCache:snap.metadata.fromCache,pending:snap.metadata.hasPendingWrites,data:snap.exists()?snap.data():null}),error),
  transaction:(ref,update)=>dbSDK.runTransaction(db,async transaction=>{if(auth.currentUser?.uid!==user.uid)throw new Error('Konto skiftet');const snapshot=await transaction.get(ref);const value=update(snapshot.exists()?snapshot.data():null);transaction.set(ref,{...value,updatedAt:dbSDK.serverTimestamp()});})
 });
 saveCloud=cloud.open(user,{
  state:value=>{if(gen!==sessionGeneration)return;clearTimeout(slowTimer);Object.assign(state,normalizeAccountState(value));refresh();$('#auth-shell').hidden=true;$('.app').hidden=false;$('.app').inert=false;$('#sync-state').textContent='Profiler synkroniseret';},
  connection:online=>{if(gen!==sessionGeneration)return;$('.app').inert=!online;$('#sync-state').textContent=online?'Forbundet':'Offline · redigering sat på pause';},
  error:fail,
  busy:busy=>{if(gen!==sessionGeneration)return;$('.app').inert=busy;$('#sync-state').textContent=busy?'Gemmer…':'Forbundet';},
  saved:()=>{if(gen===sessionGeneration)$('#sync-state').textContent='Gemt på din konto';}
 });
}).catch(()=>{$('#auth-message').textContent='Login kunne ikke startes. Kontrollér internetforbindelsen.';});
