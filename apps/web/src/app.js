import {initPageScroll} from './features/page-scroll.js';
import {createFenceEditor} from './features/fence-editor.js';
import {installCspDiagnostics} from './features/csp-diagnostics.js';
import {initSettingsTabs} from './features/settings-tabs.js';
import {createProfileSheet} from './features/profile-sheet.js';
import {initStatusStrip} from './features/status-strip.js';
import {collapseHints} from './features/hints.js';
import {createSnooze} from './features/snooze.js';
import {createAdmin} from './features/admin.js';
import {parsePairing,pairingLink,drawPairingQR} from './features/pairing.js';
import {profilePhoto} from './features/photo.js';
import {createWakeLock} from './features/wake-lock.js';
import {createAlarmArchive} from './features/alarm-archive.js';
import {homeStatus,recentMovement,ageText} from './shared/status.js';
import {createHistoryView} from './features/history-view.js';
import {danishDate,routeAnalysis} from './shared/history.js';
import {cleanAlerts,isQuiet} from './shared/alerts.js';
import {validPolygon} from './shared/fence.js';
import {createGeofenceMonitor} from './features/geofence.js';
import {mapConfig} from './config/maps.js';
import {startAuthentication} from './features/auth.js';
import {createCloudState} from './features/cloud-state.js';
import {emptyState,normalizeAccountState} from './features/account-state.js';
import {icon} from './components/icons.js';
import {types,newProfile,profileSubtitle,createId} from './features/profiles.js';
import {loadState} from './features/storage.js';
import {createTrackerClient} from './features/tracker.js';
import {demoFor} from './features/demo.js';
import {createMap,layers} from './features/maps.js';
import {createLocation} from './features/location.js';
import {distance,formatDistance,bearing,relativeBearing,directionName} from './shared/geo.js';
const $=s=>document.querySelector(s);
const state=emptyState();
const settingsTabs=initSettingsTabs();collapseHints();
for(const d of document.querySelectorAll('details.history-more'))d.open=window.matchMedia('(min-width:701px)').matches;
const profileSheet=createProfileSheet({select:$('#profile-select'),add:$('#add-profile')});initStatusStrip();
let invitationPresented=false,pairingPresented=false;
let pendingPairing=parsePairing(window.location.href,window.location.origin)||parsePairing(sessionStorage.getItem('pejlo-pairing'),window.location.origin);
if(pendingPairing){sessionStorage.setItem('pejlo-pairing',pairingLink(pendingPairing.identifier,pendingPairing.code,window.location.origin));if(window.location.hash.startsWith('#parring='))window.history.replaceState(null,'',window.location.pathname+window.location.search+'#indstillinger');}
let pendingPause=new URLSearchParams(window.location.search).get('handling')==='pause';

const invitationMatch=window.location.hash.match(/^#invitation=([a-fA-F0-9]{32})$/);
let pendingTracker=new URLSearchParams(window.location.search).get('profil');
// Technical policy diagnostics are kept in the developer console.
$('#auth-retry').addEventListener('click',()=>window.location.reload());
installCspDiagnostics();
if(invitationMatch){sessionStorage.setItem('pejlo-invitation',invitationMatch[1]);window.history.replaceState(null,'','#indstillinger');}

let saveCloud=null,cloud=null,sessionGeneration=0;
let currentPage='kort', overviewMap, searchMap, chosenLayer='demo', choosingHome=false, user=null, heading=null, headingTime=0, watching=false, simulation=false, demoStep=0, toastTimer;
const selected=()=>state.profiles.find(p=>p.id===state.activeId);
let trackerData=null,trackerError='',trackerUser=null,ownedTrackers=[],pollingId=null;
const trackerClient=createTrackerClient();
const geofenceMonitor=createGeofenceMonitor();
let polygonDraft=null;
let family=new Map(),settingsDirty=false,familyReady=false,lastInviteProfile=null,lastInviteText='',familyLoading=false,familySaving=false,alertsId=null,alertsConfig=cleanAlerts(),alertsGeneration=0,historyProfile=null;
const snooze=createSnooze({request:trackerRequest,selected,notice:toast});
const admin=createAdmin({request:trackerRequest});
const alarms=createAlarmArchive({request:trackerRequest,selected});
const wake=createWakeLock({onState:text=>$('#wake-status').textContent=text});
const history=createHistoryView({request:trackerRequest,selected,layer:()=>chosenLayer,key:()=>mapConfig.apiKey,notice:toast});
const fenceEditor=createFenceEditor({selected,layer:()=>chosenLayer,key:()=>mapConfig.apiKey,notice:toast,canEdit:()=>family.get(selected()?.trackerId)?.role!=='viewer',save:async(home,name,enabled,id)=>{
 const p=selected(),gen=sessionGeneration;if(!p||p.id!==id)throw Error('Profilen er skiftet. Åbn området igen.');const candidate=structuredClone(p);candidate.home=home;candidate.homeConfirmed=true;candidate.geofenceEnabled=enabled;
 if(!candidate.activeFenceId){if(candidate.fencePresets.length>=20)throw Error('Der er plads til 20 områder per profil.');candidate.activeFenceId=createId();candidate.fencePresets.push({id:candidate.activeFenceId,name,home:structuredClone(home)});}else Object.assign(candidate.fencePresets.find(f=>f.id===candidate.activeFenceId),{name,home:structuredClone(home)});
 await saveFence(candidate);if(gen!==sessionGeneration||selected()?.id!==id)throw Error('Konto eller profil er skiftet.');Object.assign(p,candidate);geofenceMonitor.clear();if(!await persist())throw Error('Gemningen kunne ikke bekræftes. Prøv igen.');refresh();
}});
const isLinked=()=>!!selected()?.trackerId;
const data=()=>!selected()?null:!isLinked()?demoFor(selected()):trackerData?.device.identifier===selected().trackerId?trackerData:{source:'traccar',position:null,route:[],historyAvailable:false};
async function trackerRequest(path,body){
 const token=await trackerUser.getIdToken();
 const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Handlingen kunne ikke gennemføres.');return result;
}
async function loadTrackers(){
 const gen=sessionGeneration;
 try{const result=await trackerRequest('trackers');if(gen!==sessionGeneration)return;
 ownedTrackers=result.trackers;$('#tracker-admin').hidden=!result.isAdmin;admin.enable(result.isAdmin);$('#my-uid').textContent=result.uid;trackerError='';updateTrackerStatus();
 }catch(error){if(gen===sessionGeneration){trackerError=error.message;updateTrackerStatus();}}
}
function connectTracker(){
 trackerClient.stop();pollingId=null;
 if(!trackerUser||!selected()?.trackerId){trackerData=null;updateTrackerStatus();return;}
 const id=selected().trackerId;pollingId=id;const gen=sessionGeneration;
 trackerError='Henter trackerdata…';updateTrackerStatus();
 trackerClient.start(trackerUser,id,value=>{if(gen!==sessionGeneration||pollingId!==id)return;trackerData=value;trackerError='';const pending=currentPage==='indstillinger'&&settingsDirty?Array.from(document.querySelectorAll('#profile-form input,#profile-form select,#home-form input,#home-form select'),e=>[e,e.type==='checkbox'?e.checked:e.value]):[];refresh();for(const [element,value] of pending)if(element.type==='checkbox')element.checked=value;else element.value=value;},message=>{if(gen!==sessionGeneration||pollingId!==id)return;trackerError=message;updateTrackerStatus();});
}
function updateTrackerStatus(){
 const d=data(),live=isLinked();
 $('.demo-banner b').textContent=live?'Traccar · testserver':'Eksempeldata';
 $('.demo-banner span:last-child').textContent=live?(trackerError||(!d.position?'Venter på første gyldige GPS-position':d.device?.status==='online'?'Tracker online':'Tracker offline / ukendt · senest kendte position')):'Ingen tracker tilknyttet denne profil';
 $('#tracker-message').textContent=trackerError||(trackerData?'Testserver: '+trackerData.device.name+' · '+trackerData.device.status:ownedTrackers.length?'Vælg din tracker i profilen, og gem.':'Tilføj din tracker med ID og parringskode nedenfor.');
 const value=selected()?.trackerId||'';
 options($('#profile-tracker'),[['','Ingen tracker · vis eksempeldata'],...ownedTrackers.map(t=>[t.identifier,t.name+' · '+t.identifier]),...(!ownedTrackers.some(t=>t.identifier===value)&&value?[[value,value]]:[])],value);
 $('#battery-value').textContent=d?.position?.battery!=null?d.position.battery+' %'+(live?'':' · eksempel'):'Ikke oplyst';
 $('#find').disabled=live&&!d?.position;$('#navigate').hidden=live&&!d?.position;$('#map').setAttribute('aria-label',live?'Kort med senest kendte position':'Kort med eksempelposition');
 $('#simulate').closest('article').hidden=live;
 labelLayer();
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),6000);}
async function persist(){
 const gen=sessionGeneration;
 if(!saveCloud){toast('Kontoen er ikke klar. Genindlæs forbindelsen.');return;}
 try{
  for(const p of state.profiles)if(p.trackerId)await saveFamilyProfile(p);
  if(gen!==sessionGeneration)return;
  await saveCloud(structuredClone(state));settingsDirty=false;return true;
 }catch(e){if(gen===sessionGeneration){toast(e.message||'Ændringen blev ikke gemt. Prøv igen.');settingsDirty=false;await loadFamily(true);}return false;}
}
function options(select,items,value){select.replaceChildren();for(const [id,label] of items){const o=document.createElement('option');o.value=id;o.textContent=label;select.append(o);}select.value=value;}
function renderMap(m){if(!selected())return;m?.profile(selected(),data(),{showRoute:$('#show-route').checked,showHome:$('#show-home').checked,showDistanceLine:$('#show-distance-line').checked,showRings:$('#show-distance-rings').checked});}
function showPage(name){
  if(!selected()){name='velkommen';}
  else if(!['kort','ture','indstillinger','soeg'].includes(name))name='kort';
  if(currentPage==='soeg'&&name!=='soeg')stopLocation(false);
  if(currentPage==='ture'&&name!=='ture')history.stop();
  const openingHistory=currentPage!=='ture'&&name==='ture';
  currentPage=name;
  if(name==='soeg')wake.page(true);else{wake.stop();$('#keep-awake').checked=false;}
  $('#family-join-panel').hidden=!['indstillinger','velkommen'].includes(name);
  document.querySelectorAll('.page').forEach(e=>e.hidden=e.id!==name);
  document.querySelectorAll('nav button').forEach(e=>e.classList.toggle('active',e.dataset.page===name||(name==='soeg'&&e.dataset.page==='kort')));
  $('#page-title').textContent={kort:'Dit overblik',ture:'Ture og bevægelser',indstillinger:'Dine profiler og indstillinger',soeg:'Find '+(selected()?.name??''),velkommen:'Velkommen til Pejlo'}[name];
  if(openingHistory){history.load();alarms.load();}
  if(name==='kort'&&!polygonDraft)requestAnimationFrame(()=>overviewMap?.fit(selected(),data()));
  if(name==='soeg')requestAnimationFrame(()=>{if(!searchMap){searchMap=createMap('search-map',{notice:toast,onManual:()=>{$('#autozoom').checked=false;}});searchMap?.layer(chosenLayer,mapConfig.apiKey);}renderMap(searchMap);searchMap?.fit(selected(),data());updateSearch();});
}
function go(name,tab){if(tab)settingsTabs?.select(tab);window.location.hash=name;showPage(name);}
function refresh(){
  if(pendingTracker){const found=state.profiles.find(p=>p.trackerId===pendingTracker);if(found){state.activeId=found.id;pendingTracker=null;if(pendingPause){currentPage='indstillinger';settingsTabs?.select('beskeder');$('#pause-action').hidden=false;pendingPause=false;}if(window.location.search)window.history.replaceState(null,'',window.location.pathname+window.location.hash);}}
  $('#pairing-pending').hidden=!pendingPairing;
  const empty=!selected();
  if(trackerUser&&(selected()?.trackerId||null)!==pollingId)connectTracker();
  $('.profile-bar').hidden=empty;$('.demo-banner').hidden=empty;$('.pet').hidden=empty;
  document.querySelectorAll('nav button').forEach(b=>b.disabled=empty);
  if(empty){profileSheet.update([],null);snooze.clear();alarms.clear();history.clear();historyProfile=null;options($('#profile-select'),[],null);$('#side-name').textContent='';$('#side-type').textContent='';$('#timeline').replaceChildren();for(const id of ['status-title','history-title','search-title'])$('#'+id).textContent='';for(const id of ['profile-name','profile-device','lat','lon','radius'])$('#'+id).value='';showPage('velkommen');return;}
  if(currentPage==='velkommen')currentPage='kort';
  const p=selected(),d=data(),meta=types[p.type];
  if(historyProfile!==p.id){historyProfile=p.id;history.clear();alarms.clear();if(currentPage==='ture'){history.load();alarms.load();}}
  renderFamily();loadAlerts();snooze.load();
  if(pendingPairing&&!pairingPresented){presentPairing();currentPage='indstillinger';settingsTabs?.select('tracker');}
  options($('#saved-fences'),[['','Intet gemt område valgt'],...(p.fencePresets||[]).map(f=>[f.id,f.name])],p.activeFenceId||'');
  $('#fence-name').value=p.fencePresets?.find(f=>f.id===p.activeFenceId)?.name||'';$('#delete-fence').disabled=!p.activeFenceId;$('#fence-buffer').value=p.home.buffer??5;
  options($('#profile-select'),state.profiles.map(p=>[p.id,p.name+' · '+types[p.type].label]),p.id);
  profileSheet.update(state.profiles.map(q=>({id:q.id,name:q.name,label:types[q.type].label,photo:q.photo,icon:icon(types[q.type].icon,26)})),p.id);
  $('#side-name').textContent=p.name;$('#side-type').textContent=meta.label;
  $('#side-icon').innerHTML=icon(meta.icon,30);$('#select-icon').innerHTML=icon(meta.icon,22);
  for(const id of ['side-icon','select-icon'])if(p.photo){const img=document.createElement('img');img.src=p.photo;img.alt=p.name;img.className='profile-photo-small';$('#'+id).replaceChildren(img);}
  $('#profile-photo-preview').hidden=!p.photo;if(p.photo)$('#profile-photo-preview').src=p.photo;else $('#profile-photo-preview').removeAttribute('src');$('#remove-photo').hidden=!p.photo;
  $('#status-title').textContent=p.name+(isLinked()?' · seneste position':' · eksempelposition');
  $('#find').replaceChildren();$('#find').insertAdjacentHTML('beforeend',icon('find'));$('#find').append(document.createTextNode('Find '+p.name));
  $('#home-distance').textContent=d.position&&p.homeConfirmed?formatDistance(distance(p.home,d.position)):'—';
  $('#home-title').textContent=meta.noun;
  $('#profile-name').value=p.name;$('#profile-type').value=p.type;$('#profile-device').value=p.deviceLabel;updateTrackerStatus();
  $('#lat').value=p.home.lat;$('#lon').value=p.home.lon;$('#radius').value=p.home.radius;$('#geofence-enabled').checked=p.geofenceEnabled;$('#fence-shape').value=p.home.shape||'circle';$('#polygon-count').textContent=p.home.points?.length?p.home.points.length+' punkter i området':'';fenceShapeUI();
  $('#delete-profile').hidden=false;
  $('#profile-context').textContent=meta.category==='dyr'?'Hjemmeområde og ture for '+p.name+'.':'Fast udgangspunkt og bevægelser for '+p.name+'.';
  $('#history-title').textContent=(isLinked()?'Historik for ':'Eksempelrute for ')+p.name;
  $('#history-description').textContent=isLinked()?(d.historyAvailable?'Vælg i dag, i går eller en periode på højst 31 dage. Datoer og klokkeslæt er dansk tid.':'Dagens historik kunne ikke hentes. Prøv igen senere.'):'En opdigtet rute viser, hvordan positionshistorikken kan fungere.';
  $('#route-label').textContent=isLinked()?'DAGENS GPS-PUNKTER · DANSK TID':'DAGENS EKSEMPELRUTE';
  $('#position-label').textContent=isLinked()?'SENEST KENDTE POSITION':'SENEST KENDTE EKSEMPELPOSITION';
  $('#history-label').textContent=isLinked()?'REGISTRERINGER FRA TRACCAR':'EKSEMPEL · IKKE SPORINGSHISTORIK';
  $('#point-count').textContent=d.route.length;
  $('#point-label').textContent=isLinked()?'GPS-punkter':'eksempelpunkter';
  $('#search-title').textContent='Find '+p.name;
  $('#trip-distance').textContent=isLinked()&&d.route.length<2?'—':formatDistance(routeAnalysis(d.route).meters);

  if(d.position)$('#navigate').href=`https://www.google.com/maps/search/?api=1&query=${d.position.lat},${d.position.lon}`;
  renderMap(overviewMap);renderMap(searchMap);updateAge();updateSearch();showPage(currentPage);
}
function updateGeofence(){
 if(!selected())return;
 const result=geofenceMonitor.evaluate(selected(),data(),{unavailable:!!trackerError});
 const area=selected().fencePresets?.find(f=>f.id===selected().activeFenceId);$('#geofence-status').textContent=(area?area.name+' · ':'')+result.text;$('#fence-margin-description').textContent='To nye positioner og '+(selected().home.buffer??5)+' meters ekstra margen.';$('.geofence-summary').dataset.state=result.kind;
 if(result.transition&&!snooze.paused()&&alertsConfig[result.transition]&&!isQuiet(alertsConfig))toast(selected().name+' · '+(area?.name||'Hjemmeområde')+(result.transition==='exit'?' har forladt hjemmeområdet.':' er tilbage i hjemmeområdet.'));
}
function updateAge(){
 updateGeofence();
 snooze.tick();
 if(!selected())return;
 const d=data(),p=d.position,live=isLinked();
 $('#home-observation').textContent=live?homeStatus(selected(),p):'Eksempeldata · ikke en rigtig hjemmestatus';
 const contact=d.device?.lastContact;$('#last-contact').textContent=live?ageText(contact):'Eksempeldata';$('#last-contact').title=Number.isFinite(contact)?new Date(contact).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen'}):'Kontaktoplysningen kommer fra Traccar, særskilt fra GPS-positionen.';
 if(!p){$('#age').textContent='Ingen position';$('#freshness').textContent='Afventer GPS';$('#search-age').textContent='Der er endnu ingen gyldig position fra trackeren.';return;}
 const seconds=Math.max(0,Math.floor((Date.now()-p.timestamp)/1000));
 const text=seconds<60?seconds+' sek. siden':seconds<3600?Math.floor(seconds/60)+' min. siden':Math.floor(seconds/3600)+' timer siden';
 $('#age').textContent=text;
 $('#freshness').textContent=live?(seconds>300?'Gammel position':'Seneste registrering'):(seconds>300?'Gammel eksempelposition':'Eksempel');
 $('#search-age').textContent=(seconds>300?'OBS: gammel position. ':'')+(live?'Seneste registrering fra ':'Målet er en eksempelposition fra ')+text+'.';
}
function updateSearch(){
  if(!selected())return;
  const target=data().position;
  $('#search-home-distance').textContent=target&&selected().homeConfirmed?'Afstand fra hjem til seneste position: '+formatDistance(distance(selected().home,target)):'Vælg et fast hjemmepunkt for at vise afstand hjemmefra.';
  const movement=isLinked()?recentMovement(data().route,target):null;$('#movement-text').textContent=movement?'Seneste målte bevægelse mod '+movement.direction+' ('+Math.round(movement.degrees)+'°). Viser bevægelsen frem til seneste GPS-punkt.':'Bevægelsesretning er usikker eller ikke tilgængelig. Kompaspilen viser retningen fra dig til seneste position.';
  if(!target){$('#search-distance').textContent='— m';$('#direction-text').textContent='Afventer en gyldig GPS-position fra trackeren.';$('#compass-arrow').style.opacity='.25';searchMap?.clearPhone();return;}
  if(!user){$('#search-distance').textContent='— m';$('#direction-text').textContent='Start placering for at se afstand og retning.';$('#compass-arrow').style.opacity='.25';searchMap?.clearPhone();return;}
  const meters=distance(user,target),b=bearing(user,target),phoneStale=Date.now()-user.timestamp>20000;
  const hasHeading=heading!==null&&Date.now()-headingTime<10000&&!simulation;
  $('#search-distance').textContent=formatDistance(meters);
  const near=meters<=Math.max(user.accuracy,15);
  $('#direction-text').textContent=phoneStale?'Din placering er gammel. Vent på et nyt GPS-punkt.':near?'Tæt på den viste position. Afstanden er inden for mobilens GPS-usikkerhed.':Math.round(b)+'° mod '+directionName(b)+' · i fugleflugtslinje';
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
let layerRequest=0;
function labelLayer(){
 document.querySelectorAll('.layer-select').forEach(s=>s.value=chosenLayer);
 document.querySelectorAll('.map-caption').forEach(e=>e.textContent=chosenLayer==='demo'?'SKEMATISK EKSEMPEL · IKKE GEOGRAFISK KORT':(isLinked()?'GEOGRAFISK KORT · SENEST KENDTE GPS-POSITION':'GEOGRAFISK KORT · POSITIONER ER EKSEMPLER'));
}
async function selectLayer(name){
 const request=++layerRequest;
 document.querySelectorAll('.layer-select').forEach(s=>s.disabled=true);
 const ok=await overviewMap?.layer(name,mapConfig.apiKey);
 if(request!==layerRequest)return;
 if(ok){chosenLayer=name;await searchMap?.layer(name,mapConfig.apiKey);}
 if(request!==layerRequest)return;
 labelLayer();document.querySelectorAll('.layer-select').forEach(s=>s.disabled=false);
}
for(const select of document.querySelectorAll('.layer-select')){options(select,Object.entries(layers),'demo');select.onchange=()=>selectLayer(select.value);}
overviewMap=createMap('map',{notice:toast,onHome:p=>{if(polygonDraft){if(polygonDraft.points.length>=50)return toast('Højst 50 punkter.');polygonDraft.points.push(p);updateDraft();return;}if(!choosingHome)return;choosingHome=false;$('#set-map-home').textContent='Sæt fast udgangspunkt';if(confirm('Gem dette som hjemmeområdets midtpunkt for '+selected().name+'?'+(chosenLayer==='demo'?' Eksempelkortets veje er skematiske.':''))){selected().home={...selected().home,...p};selected().homeConfirmed=true;const stored=selected().fencePresets.find(f=>f.id===selected().activeFenceId);if(stored)stored.home=structuredClone(selected().home);persist();refresh();}}});
$('#profile-select').onchange=e=>{settingsDirty=false;cancelDrawing();stopLocation(false);state.activeId=e.target.value;persist();refresh();};
$('#fit').onclick=()=>{if(selected())overviewMap?.fit(selected(),data());};
$('#find').onclick=()=>go('soeg');
$('#show-route').onchange=()=>{renderMap(overviewMap);renderMap(searchMap);};$('#show-home').onchange=$('#show-route').onchange;$('#show-distance-line').onchange=$('#show-route').onchange;$('#show-distance-rings').onchange=$('#show-route').onchange;
$('#set-map-home').onclick=()=>{choosingHome=!choosingHome;$('#set-map-home').textContent=choosingHome?'Annuller valg':'Sæt fast udgangspunkt';if(choosingHome)toast(chosenLayer==='demo'?'Vælg først et geografisk kortlag til dit rigtige hjem.':'Tryk på dit hjem på kortet for at vælge midtpunkt.');};
$('#profile-form').onsubmit=async e=>{e.preventDefault();const name=$('#profile-name').value.trim();if(!name)return toast('Skriv et navn.');if(family.has(selected().trackerId)&&selected().trackerId!==$('#profile-tracker').value)return toast('Fjern først profilen for at skifte tracker.');if(selected().trackerId&&selected().trackerId!==$('#profile-tracker').value&&selected().geofenceEnabled){try{await saveFence({...selected(),geofenceEnabled:false});}catch{return;}selected().geofenceEnabled=false;}Object.assign(selected(),{name,type:$('#profile-type').value,deviceLabel:$('#profile-device').value.trim(),trackerId:$('#profile-tracker').value});if(await persist()){refresh();toast('Profil gemt. Navn og ikon er opdateret.');}};
$('#home-form').onsubmit=async e=>{
 e.preventDefault();if(!e.target.reportValidity())return;
 const p=selected(),gen=sessionGeneration;
 if($('#fence-shape').value==='polygon'&&!validPolygon(p.home.points))return toast('Tegn først et område på kortet.');
 const candidate=structuredClone(p);candidate.home={...p.home,shape:$('#fence-shape').value,lat:Number($('#lat').value),lon:Number($('#lon').value),radius:Number($('#radius').value),buffer:Number($('#fence-buffer').value)};
 candidate.homeConfirmed=true;candidate.geofenceEnabled=$('#geofence-enabled').checked;
 const name=$('#fence-name').value.trim();if(!name)return toast('Giv området et navn.');
 if(!candidate.activeFenceId){if(candidate.fencePresets.length>=20)return toast('Der er plads til 20 områder per profil.');candidate.activeFenceId=createId();candidate.fencePresets.push({id:candidate.activeFenceId,name,home:structuredClone(candidate.home)});}
 else Object.assign(candidate.fencePresets.find(f=>f.id===candidate.activeFenceId),{name,home:structuredClone(candidate.home)});
 try{await saveFence(candidate);}catch{return;}if(gen!==sessionGeneration||selected()?.id!==p.id)return;
 Object.assign(p,candidate);geofenceMonitor.clear();persist();refresh();
};
$('#edit-geofence').onclick=()=>{go('indstillinger','omraade');$('#home-form').scrollIntoView({behavior:'smooth',block:'center'});};
$('#use-location').onclick=()=>{if(!navigator.geolocation)return toast('Placering er ikke tilgængelig.');navigator.geolocation.getCurrentPosition(p=>{settingsDirty=true;$('#lat').value=p.coords.latitude.toFixed(6);$('#lon').value=p.coords.longitude.toFixed(6);toast('Kontrollér koordinaterne, og tryk Gem fast udgangspunkt.');},()=>toast('Placering kunne ikke hentes. Kontrollér browserens tilladelse.'),{enableHighAccuracy:true,timeout:15000,maximumAge:10000});};
function openNewProfile(){if(state.profiles.length>=50)return toast('Prototypen har plads til 50 profiler.');$('#new-profile-form').reset();$('#new-type').value='';$('#new-profile').showModal();}
$('#add-profile').onclick=openNewProfile;$('#first-profile').onclick=openNewProfile;$('#close-new').onclick=()=>$('#new-profile').close();
$('#new-profile-form').onsubmit=e=>{e.preventDefault();const p=newProfile($('#new-name').value.trim(),$('#new-type').value,$('#new-device').value.trim());if(!p)return toast('Vælg type, og skriv et navn.');stopLocation(false);state.profiles.push(p);state.activeId=p.id;persist();$('#new-profile').close();refresh();toast('Profil oprettet med eksempeldata.');};
$('#delete-profile').onclick=async()=>{if(!selected())return;if(!confirm(family.get(selected().trackerId)?.owner===false?'Forlad den delte profil '+selected().name+'? Ejeren og andre beholder adgangen.':'Fjern profilen '+selected().name+' for alle delte brugere og stop dens beskeder? Dette sletter ikke den fysiske tracker.'))return;if(selected().trackerId){const p=selected(),entry=family.get(p.trackerId);try{await trackerRequest('family',{action:entry?.owner===false?'leave':'delete',identifier:p.trackerId});family.delete(p.trackerId);}catch(e){return toast(e.message);}}stopLocation(false);state.profiles=state.profiles.filter(p=>p.id!==state.activeId);state.activeId=state.profiles[0]?.id??null;persist();refresh();};
$('#locate').onclick=()=>{stopLocation(false);watching=true;$('#phone-state').textContent='Venter på mobilens placering…';$('#locate').textContent='Start placering igen';location.start();};
$('#enable-compass').onclick=async()=>{if(await location.compass())toast('Kompas startet. Afventer en brugbar kompasretning fra mobilen.');};
$('#stop-location').onclick=()=>stopLocation();$('#autozoom').onchange=updateSearch;
function simulate(){location.stop();watching=false;simulation=true;heading=null;const meters=[600,300,150,70,25,8][Math.min(demoStep,5)],target=data().position;user={lat:target.lat-meters/111195,lon:target.lon,accuracy:8,timestamp:Date.now()};$('#closer').hidden=false;$('#closer').disabled=demoStep>=5;$('#phone-state').classList.add('simulated');updateSearch();}
$('#simulate').onclick=()=>{demoStep=0;simulate();};$('#closer').onclick=()=>{demoStep++;simulate();};
window.addEventListener('hashchange',()=>showPage(window.location.hash.slice(1)));
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type!=='pejlo-open')return;pendingTracker=typeof event.data.tracker==='string'&&/^[A-Za-z0-9_-]{4,100}$/.test(event.data.tracker)?event.data.tracker:null;pendingPause=!!pendingTracker&&event.data.action==='pause';refresh();go(event.data.action==='pause'?'indstillinger':'kort');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(watching||simulation||heading!==null))stopLocation(false);});
window.addEventListener('pagehide',()=>{location.stop();trackerClient.stop();});
window.addEventListener('pageshow',event=>{if(event.persisted&&trackerUser)connectTracker();});
refresh();showPage(window.location.hash.slice(1));selectLayer(mapConfig.defaultLayer);setInterval(()=>{updateAge();if(currentPage==='soeg')updateSearch();},1000);

const importLocal=()=>{
 const old=loadState();if(!old.profiles.length)return toast('Der er ingen gamle lokale profiler at importere.');
 if(!confirm('Importér '+old.profiles.length+' lokale profiler til den konto, du er logget ind på?'))return;
 const ids=new Set(state.profiles.map(p=>p.id));state.profiles.push(...old.profiles.filter(p=>!ids.has(p.id)).slice(0,50-state.profiles.length));state.activeId=state.profiles[0]?.id??null;persist();refresh();
};
$('#import-local').onclick=importLocal;$('#import-first').onclick=importLocal;
$('#tracker-retry').onclick=()=>{loadTrackers();connectTracker();};
$('#claim-tracker').onsubmit=async event=>{
 event.preventDefault();if(selected()?.trackerId&&selected().trackerId!==$('#claim-id').value.trim())return toast('Vælg eller opret en tom profil til den nye tracker.');const button=event.target.querySelector('button');button.disabled=true;const gen=sessionGeneration,profileId=state.activeId;$('#claim-result').textContent='';
 try{const result=await trackerRequest('trackers/claim',{identifier:$('#claim-id').value.trim(),code:$('#claim-code').value.trim()});if(gen!==sessionGeneration)return;
 const profile=state.profiles.find(p=>p.id===profileId);if(!profile)return;profile.trackerId=result.tracker.identifier;pendingPairing=null;pairingPresented=false;sessionStorage.removeItem('pejlo-pairing');$('#pairing-input').value='';$('#pairing-status').textContent='';$('#claim-code').value='';await loadTrackers();persist();refresh();toast('Trackeren er tilknyttet din konto og profilen '+profile.name+'.');
 }catch(error){if(gen===sessionGeneration)$('#claim-result').textContent=error.message;}finally{button.disabled=false;}
};
$('#provision-tracker').onsubmit=async event=>{
 event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;const gen=sessionGeneration;
 try{const result=await trackerRequest('admin/trackers',{identifier:$('#provision-id').value.trim(),name:$('#provision-name').value.trim()});if(gen!==sessionGeneration)return;
 $('#pairing-output').hidden=true;$('#pairing-qr').replaceChildren();$('#pairing-link').value='';
 $('#provision-result').textContent='Tracker-ID: '+result.identifier+' · Parringskode: '+result.code+' — Gem koden nu. Den vises kun denne gang.';
 const link=pairingLink(result.identifier,result.code,window.location.origin);$('#pairing-link').value=link;$('#pairing-output').hidden=false;try{await drawPairingQR($('#pairing-qr'),link);if(gen!==sessionGeneration){$('#pairing-qr').replaceChildren();return;}}catch{if(gen===sessionGeneration)toast('QR-koden kunne ikke tegnes. Parringslinket kan stadig kopieres.');}
 }catch(error){if(gen===sessionGeneration)$('#provision-result').textContent=error.message;}finally{button.disabled=false;}
};
let slowTimer;
startAuthentication(async(user,{db,dbSDK,auth})=>{
 fenceEditor.reset();family=new Map();invitationPresented=false;pairingPresented=false;settingsTabs?.reset();profileSheet.update([],null);snooze.clear();admin.clear();$('#pause-action').hidden=true;$('#pairing-output').hidden=true;$('#pairing-qr').replaceChildren();$('#pairing-link').value='';familyReady=false;settingsDirty=false;lastInviteProfile=null;lastInviteText='';familyLoading=false;familySaving=false;alertsId=null;alertsGeneration++;historyProfile=null;history.clear();alarms.clear();wake.stop();$('#keep-awake').checked=false;$('#family-result').textContent='';$('#join-result').textContent='';$('#push-status').textContent='';cancelDrawing();geofenceMonitor.clear();trackerClient.stop();trackerData=null;trackerError='';trackerUser=null;ownedTrackers=[];pollingId=null;$('#tracker-admin').hidden=true;$('#provision-result').textContent='';$('#claim-code').value='';$('#claim-result').textContent='';
 const gen=++sessionGeneration;clearTimeout(slowTimer);cloud?.close();saveCloud=null;stopLocation(false);overviewMap?.clear();searchMap?.clear();choosingHome=false;$('#set-map-home').textContent='Sæt fast udgangspunkt';labelLayer();$('#new-profile').close();Object.assign(state,emptyState());refresh();
 if(!user?.emailVerified)return;
 trackerUser=user;loadTrackers();connectTracker();
 $('#sync-state').textContent='Forbinder…';$('.app').inert=true;$('#cloud-help').textContent='Opretter forbindelse til dine private profiler…';
 const fail=()=>{if(gen!==sessionGeneration)return;clearTimeout(slowTimer);$('.app').hidden=true;$('#auth-shell').hidden=false;$('#cloud-help').textContent='Profillagring kunne ikke åbnes. Kontrollér, at Firestore-databasen og reglerne fra pakken er oprettet. Derefter: Prøv forbindelsen igen.';$('#sync-state').textContent='Ingen forbindelse';};
 slowTimer=setTimeout(fail,15000);
 cloud=createCloudState({
  ref:uid=>dbSDK.doc(db,'users',uid,'private','state'),
  listen:(ref,ok,error)=>dbSDK.onSnapshot(ref,{includeMetadataChanges:true},snap=>ok({fromCache:snap.metadata.fromCache,pending:snap.metadata.hasPendingWrites,data:snap.exists()?snap.data():null}),error),
  transaction:(ref,update)=>dbSDK.runTransaction(db,async transaction=>{if(auth.currentUser?.uid!==user.uid)throw new Error('Konto skiftet');const snapshot=await transaction.get(ref);const value=update(snapshot.exists()?snapshot.data():null);transaction.set(ref,{...value,updatedAt:dbSDK.serverTimestamp()});})
 });
 saveCloud=cloud.open(user,{
  state:value=>{if(gen!==sessionGeneration)return;clearTimeout(slowTimer);Object.assign(state,normalizeAccountState(value));mergeFamily();refresh();if(!familyReady)loadFamily();const invitation=sessionStorage.getItem('pejlo-invitation');if(invitation&&!invitationPresented){invitationPresented=true;$('#family-code').value=invitation;$('#join-result').textContent='Invitationen er klar. Tryk Tilføj delt profil, når du er logget ind med den inviterede e-mail.';go('indstillinger');}$('#auth-shell').hidden=true;$('.app').hidden=false;$('.app').inert=false;$('#sync-state').textContent='Profiler synkroniseret';},
  connection:online=>{if(gen!==sessionGeneration)return;$('.app').inert=!online;$('#sync-state').textContent=online?'Forbundet':'Offline · redigering sat på pause';},
  error:fail,
  busy:busy=>{if(gen!==sessionGeneration)return;$('.app').inert=busy;$('#sync-state').textContent=busy?'Gemmer…':'Forbundet';},
  saved:()=>{if(gen===sessionGeneration)$('#sync-state').textContent='Gemt på din konto';}
 });
}).catch(()=>{$('#auth-message').textContent='Login kunne ikke startes. Kontrollér internetforbindelsen.';});

function fenceShapeUI(){const polygon=$('#fence-shape').value==='polygon';$('#radius').closest('label').hidden=polygon;$('#draw-fence').hidden=!polygon;}
function updateDraft(){const points=polygonDraft?.points||[];overviewMap?.draft(points);$('#draw-count').textContent=points.length+' punkter';$('#finish-fence').disabled=!validPolygon(points);}
function cancelDrawing(){polygonDraft=null;$('#polygon-tools').hidden=true;overviewMap?.draft([]);$('#draw-count').textContent='0 punkter';$('#finish-fence').disabled=true;}
$('#fence-shape').onchange=fenceShapeUI;
$('#draw-fence').onclick=()=>{if(chosenLayer==='demo')return toast('Vælg et geografisk kortlag før du tegner.');polygonDraft={profileId:state.activeId,points:[],name:$('#fence-name').value,buffer:$('#fence-buffer').value,enabled:$('#geofence-enabled').checked};choosingHome=false;$('#set-map-home').textContent='Sæt fast udgangspunkt';go('kort');$('#polygon-tools').hidden=false;updateDraft();$('#polygon-tools').scrollIntoView({behavior:'smooth'});};
$('#undo-point').onclick=()=>{polygonDraft?.points.pop();updateDraft();};
$('#cancel-fence').onclick=()=>{cancelDrawing();go('indstillinger');};
$('#finish-fence').onclick=()=>{if(!polygonDraft||polygonDraft.profileId!==state.activeId)return cancelDrawing();if(!validPolygon(polygonDraft.points))return toast('Brug mindst 3 forskellige punkter uden krydsende kanter. Området må højst strække sig 20 km fra første punkt.');settingsDirty=true;const draft=polygonDraft,points=draft.points;selected().home={...selected().home,shape:'polygon',points,lat:points.reduce((s,p)=>s+p.lat,0)/points.length,lon:points.reduce((s,p)=>s+p.lon,0)/points.length};cancelDrawing();refresh();$('#fence-name').value=draft.name;$('#fence-buffer').value=draft.buffer;$('#geofence-enabled').checked=draft.enabled;go('indstillinger','omraade');$('#home-form').scrollIntoView({behavior:'smooth'});toast('Området er tegnet. Slå overvågning til, og tryk Gem hjemmeområde.');};

async function saveFence(profile){
 if(!profile.trackerId){toast('Området gemmes på profilen. Tilknyt en tracker for overvågning.');return;}
 try{await saveFamilyProfile(profile);toast('Fælles område gemt. Overvågning '+(profile.geofenceEnabled?'slået til.':'slået fra.'));}
 catch(error){toast(error.message);await loadFamily(true);throw error;}
}
async function pushSubscription(){const registration=await navigator.serviceWorker.getRegistration('/');return registration?.pushManager.getSubscription();}
$('#enable-push').onclick=async()=>{
 const gen=sessionGeneration;
 try{
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('Push understøttes ikke her. På iPhone: åbn Pejlo fra hjemmeskærmen.');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Beskeder er ikke tilladt. Tillad dem i browserens eller telefonens indstillinger.');
  const config=await trackerRequest('push/config');if(!config.ready)throw Error('Push mangler engangsopsætningen i Cloudflare.');
  const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
  const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  let sub=await registration.pushManager.getSubscription();if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  if(gen!==sessionGeneration){await sub.unsubscribe();return;}
  await trackerRequest('push/subscribe',{subscription:sub.toJSON()});if(gen===sessionGeneration)$('#push-status').textContent='Beskeder er aktiveret på denne enhed. Tryk Send testbesked for at kontrollere leveringen.';
 }catch(error){if(gen===sessionGeneration)$('#push-status').textContent=error.message;}
};
$('#disable-push').onclick=async()=>{try{const sub=await pushSubscription();if(sub){await trackerRequest('push/remove',{subscription:sub.toJSON()});await sub.unsubscribe();}$('#push-status').textContent='Beskeder er slået fra på denne enhed.';}catch(error){$('#push-status').textContent=error.message;}};
$('#test-push').onclick=async()=>{try{const sub=await pushSubscription();if(!sub)throw Error('Aktivér først beskeder på denne enhed.');await trackerRequest('push/test',{subscription:sub.toJSON()});$('#push-status').textContent='Testbeskeden er afleveret til push-tjenesten.';}catch(error){$('#push-status').textContent=error.message;}};

async function commitAreaChange(candidate){const p=selected(),gen=sessionGeneration;try{await saveFence(candidate);}catch{return false;}if(gen!==sessionGeneration||selected()?.id!==p.id)return false;Object.assign(p,candidate);geofenceMonitor.clear();cancelDrawing();persist();refresh();return true;}
$('#saved-fences').onchange=async e=>{const p=selected(),f=p.fencePresets.find(f=>f.id===e.target.value);if(!f){refresh();return;}settingsDirty=false;const next={...structuredClone(p),home:structuredClone(f.home),activeFenceId:f.id,homeConfirmed:true};await commitAreaChange(next);};
$('#new-fence').onclick=async()=>{const p=selected();if(p.fencePresets.length>=20)return toast('Der er plads til 20 områder per profil.');const next={...structuredClone(p),activeFenceId:null,home:{lat:p.home.lat,lon:p.home.lon,radius:p.home.radius,buffer:p.home.buffer??5,shape:'circle'},geofenceEnabled:false,homeConfirmed:false};if(await commitAreaChange(next)){$('#fence-name').focus();toast('Navngiv og tegn det nye område, og tryk Gem hjemmeområde. Overvågningen er sat på pause.');}};
$('#delete-fence').onclick=async()=>{const p=selected(),f=p.fencePresets.find(f=>f.id===p.activeFenceId);if(!f||!confirm('Slet området '+f.name+'? Overvågningen af dette område slås fra.'))return;const next={...structuredClone(p),activeFenceId:null,home:{lat:p.home.lat,lon:p.home.lon,radius:p.home.radius,buffer:p.home.buffer??5,shape:'circle'},geofenceEnabled:false,homeConfirmed:false,fencePresets:p.fencePresets.filter(x=>x.id!==f.id)};if(await commitAreaChange(next))toast('Området er slettet. Vælg et andet område for at fortsætte.');};

function mergeFamily(){
 for(const entry of family.values()){
  const p=structuredClone(entry.profile),index=state.profiles.findIndex(x=>x.trackerId===p.trackerId);
  if(index>=0){const oldId=state.profiles[index].id;state.profiles[index]=p;if(state.activeId===oldId)state.activeId=p.id;}
  else if(state.profiles.length<50)state.profiles.push(p);
 }
 if(!state.profiles.some(p=>p.id===state.activeId))state.activeId=state.profiles[0]?.id??null;
}
async function saveFamilyProfile(profile){
 if(!profile.trackerId)return;
 if(!familyReady)throw Error('Vent på at familiedelingen er hentet, og gem igen.');
 const entry=family.get(profile.trackerId);
 if(entry&&JSON.stringify(entry.profile)===JSON.stringify(profile))return;
 if(entry?.role==='viewer')throw Error('Du har kun læseadgang til denne profil.');
 if(!entry&&!ownedTrackers.some(t=>t.identifier===profile.trackerId&&t.is_owner!==0))throw Error('Du har ikke længere adgang til profilen.');
 if(state.profiles.filter(p=>p.trackerId===profile.trackerId).length>1)throw Error('Brug én fælles profil per tracker. Fjern den ekstra profil først.');
 if(familySaving)throw Error('En ændring er ved at blive gemt. Prøv igen om et øjeblik.');
 const gen=sessionGeneration;familySaving=true;$('.app').inert=true;
 try{
  const result=await trackerRequest('family',{action:'save',identifier:profile.trackerId,profile,revision:entry?.revision||0});
  if(gen!==sessionGeneration)return;
  family.set(profile.trackerId,{...entry,profile:structuredClone(profile),revision:result.revision,owner:entry?.owner??true,members:entry?.members||[]});
 }finally{if(gen===sessionGeneration){familySaving=false;$('.app').inert=false;}}
}
async function loadFamily(force=false){
 if(!trackerUser||familyLoading||familySaving||(!force&&settingsDirty))return;
 // Keep unsaved form edits on screen while the canonical profile updates underneath.
 const pending=currentPage==='indstillinger'&&settingsDirty&&!force?Array.from(document.querySelectorAll('#profile-form input,#profile-form select,#home-form input,#home-form select'),e=>[e,e.type==='checkbox'?e.checked:e.value]):[];
 const gen=sessionGeneration;familyLoading=true;
 try{
  await loadTrackers();const result=await trackerRequest('family');if(gen!==sessionGeneration)return;
  const next=new Map(result.profiles.map(e=>[e.profile.trackerId,e]));
  state.profiles=state.profiles.filter(p=>!p.trackerId||ownedTrackers.some(t=>t.identifier===p.trackerId));
  family=next;familyReady=true;mergeFamily();
  // Publish existing linked private profiles once, retaining their saved geofences.
  for(const p of state.profiles)if(p.trackerId&&!family.has(p.trackerId)&&ownedTrackers.some(t=>t.identifier===p.trackerId&&t.is_owner!==0))await saveFamilyProfile(p);
  if(gen!==sessionGeneration)return;refresh();for(const [el,v] of pending)if(el.type==='checkbox')el.checked=v;else el.value=v;
 }catch(error){if(gen===sessionGeneration)toast('Familiedeling: '+error.message);}
 finally{if(gen===sessionGeneration)familyLoading=false;}
}
function renderFamily(){
 const p=selected(),entry=family.get(p?.trackerId),linked=!!p?.trackerId;
 $('#family-invite').hidden=!linked||entry?.owner===false;$('#family-leave').hidden=!linked||entry?.owner!==false;
 $('#family-members').replaceChildren();
 if(entry?.owner===false)$('#family-members').textContent=entry.role==='viewer'?'Delt med dig som læser. Du kan se position og historik og vælge dine egne beskeder, men ikke ændre profil eller områder.':'Delt med dig. Navn og områder er fælles med ejeren, som får besked, hvis du ændrer området.';
 for(const member of [...(entry?.members||[]),...(entry?.invites||[]).map(i=>({...i,pending:true}))]){const line=document.createElement('p'),button=document.createElement('button');line.textContent=member.email+(member.pending?' · afventer':'')+' · '+(member.role==='viewer'?'kun se':'kan redigere');button.textContent=member.pending?'Annuller invitation':'Fjern adgang';button.className='text-button';button.type='button';button.onclick=async()=>{if(!confirm('Fjern adgang for '+member.email+'?'))return;try{await trackerRequest('family',{action:'revoke',identifier:p.trackerId,uid:member.uid,email:member.email});await loadFamily(true);toast('Adgangen er fjernet.');}catch(e){toast(e.message);}};if(!member.pending){const roleButton=document.createElement('button'),next=member.role==='viewer'?'editor':'viewer';roleButton.type='button';roleButton.className='text-button';roleButton.textContent=next==='viewer'?'Gør til læser':'Giv redigeringsret';roleButton.onclick=async()=>{try{await trackerRequest('family',{action:'setrole',identifier:p.trackerId,uid:member.uid,role:next});await loadFamily(true);toast('Adgangen er ændret.');}catch(e){toast(e.message);}};line.append(roleButton);}
  line.append(button);$('#family-members').append(line);}
 const viewer=entry?.role==='viewer';
 for(const el of document.querySelectorAll('#profile-form :is(input,select,button):not(#delete-profile),#home-form :is(input,select,button),#edit-geofence,#set-map-home'))el.inert=viewer;
 $('.app').classList.toggle('viewer-mode',viewer);
 $('#profile-tracker').disabled=!!entry;$('#family-result').textContent=lastInviteProfile===p?.id?lastInviteText:'';
}
async function loadAlerts(force=false){
 const id=selected()?.trackerId||null;if(!force&&alertsId===id)return;alertsId=id;const gen=++alertsGeneration;
 $('#alerts-form').inert=true;$('#alerts-status').textContent=id?'Henter dine alarmvalg…':'Tilknyt en tracker for at vælge beskeder.';
 if(!id)return;
 try{const result=await trackerRequest('alerts?identifier='+encodeURIComponent(id));if(gen!==alertsGeneration)return;
 alertsConfig=result.config;for(const [k,v] of Object.entries(result.config)){const el=$('#alert-'+k);if(typeof v==='boolean')el.checked=v;else el.value=v;}
 $('#alerts-form').inert=false;$('#alerts-status').textContent='Dine alarmvalg er hentet.';
 }catch(e){if(gen===alertsGeneration){alertsId=null;$('#alerts-status').textContent=e.message;}}
}
$('#alerts-form').onsubmit=async e=>{
 e.preventDefault();const identifier=selected()?.trackerId;if(!identifier)return;
 const config=cleanAlerts(Object.fromEntries(Object.entries(cleanAlerts()).map(([k,v])=>[k,typeof v==='boolean'?$('#alert-'+k).checked:typeof v==='number'?Number($('#alert-'+k).value):$('#alert-'+k).value])));
 const gen=sessionGeneration;$('#alerts-form').inert=true;
 try{await trackerRequest('alerts',{identifier,config});alertsConfig=config;if(gen===sessionGeneration&&selected()?.trackerId===identifier)$('#alerts-status').textContent='Dine alarmindstillinger er gemt. Husk at aktivere push på hver enhed.';}
 catch(e){if(gen===sessionGeneration)$('#alerts-status').textContent=e.message;}
 finally{if(gen===sessionGeneration)$('#alerts-form').inert=false;}
};
$('#family-invite').onsubmit=async e=>{e.preventDefault();const p=selected();if(!p?.trackerId)return toast('Tilknyt først en tracker.');try{await saveFamilyProfile(p);const result=await trackerRequest('family',{action:'invite',identifier:p.trackerId,email:$('#family-email').value,role:$('#family-role').value});lastInviteProfile=p.id;lastInviteText=(result.mailSent?'Invitationsmailen er afleveret til mailtjenesten. Bed modtageren kontrollere indbakke og spam. ':result.message+' ')+'Invitationskode: '+result.code+' · Gyldig i 7 dage.';$('#family-result').textContent=lastInviteText;}catch(error){$('#family-result').textContent=error.message;}};
$('#family-join').onsubmit=async e=>{e.preventDefault();try{await trackerRequest('family',{action:'join',code:$('#family-code').value.trim()});$('#family-code').value='';sessionStorage.removeItem('pejlo-invitation');await loadFamily(true);persist();$('#join-result').textContent='Den delte profil er tilføjet. Vælg den øverst.';}catch(error){$('#join-result').textContent=error.message;}};
$('#family-leave').onclick=()=>$('#delete-profile').click();
setInterval(()=>{if(trackerUser&&!document.hidden){loadFamily();snooze.load(true);}},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&trackerUser)snooze.load(true);});

for(const form of ['profile-form','home-form'])for(const event of ['input','change'])$('#'+form).addEventListener(event,()=>{settingsDirty=true;});

$('#keep-awake').onchange=()=>wake.set($('#keep-awake').checked);
document.addEventListener('visibilitychange',()=>wake.visibility());window.addEventListener('pagehide',()=>{wake.stop();$('#keep-awake').checked=false;});
$('#profile-photo').onchange=async event=>{
 const file=event.target.files?.[0],p=selected(),gen=sessionGeneration;if(!file||!p)return;
 if(family.get(p.trackerId)?.role==='viewer'){event.target.value='';return toast('Du har kun læseadgang til profilen.');}
 try{const photo=await profilePhoto(file);if(gen!==sessionGeneration||selected()?.id!==p.id)return;p.photo=photo;if(await persist()){refresh();toast('Profilfotoet er gemt.');}}
 catch(e){toast(e.message);}finally{event.target.value='';}
};
$('#remove-photo').onclick=async()=>{const p=selected();if(!p||family.get(p.trackerId)?.role==='viewer')return;p.photo='';if(await persist()){refresh();toast('Profilfotoet er fjernet.');}};

function presentPairing(){
 if(!pendingPairing)return;settingsTabs?.select('tracker');pairingPresented=true;$('#claim-id').value=pendingPairing.identifier;$('#claim-code').value=pendingPairing.code;$('#pairing-status').textContent='Parringslinket er læst. Kontrollér tracker-ID, vælg en tom profil, og tryk Tilføj tracker til denne profil.';
}
$('#read-pairing').onclick=()=>{const value=parsePairing($('#pairing-input').value.trim(),window.location.origin);if(!value)return toast('Linket er ikke et gyldigt parringslink til denne Pejlo-app.');pendingPairing=value;sessionStorage.setItem('pejlo-pairing',pairingLink(value.identifier,value.code,window.location.origin));presentPairing();$('#pairing-input').value='';$('#pairing-pending').hidden=false;};
$('#copy-pairing').onclick=async()=>{try{await navigator.clipboard.writeText($('#pairing-link').value);toast('Parringslinket er kopieret.');}catch{$('#pairing-link').select();toast('Markér og kopiér linket manuelt.');}};

$('#toggle-map-info').onclick=()=>{const card=$('.status-card'),expanded=card.classList.toggle('expanded');$('#toggle-map-info').setAttribute('aria-expanded',String(expanded));$('#toggle-map-info').textContent=expanded?'Færre oplysninger ⌄':'Flere oplysninger ⌃';};
$('#center-loui').onclick=()=>{const point=data()?.position;if(!point)return toast('Der er ingen gyldig GPS-position endnu.');overviewMap?.center(point);};
$('#map-fence').onclick=()=>fenceEditor.open();$('#map-trips').onclick=()=>go('ture');$('#map-pause').onclick=()=>go('indstillinger','beskeder');

initPageScroll();
