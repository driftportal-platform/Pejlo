import {startAuthentication} from './features/auth.js';
import {createAdmin} from './features/admin.js';
import {createPlatformAdmin} from './features/platform-admin.js';
import {pairingLink,drawPairingQR} from './features/pairing.js';

const $=selector=>document.querySelector(selector);
let session=null;
let generation=0;

async function request(path,body){
 const token=await session.getIdToken();
 const response=await fetch('/api/'+path,{
  method:body?'POST':'GET',
  headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,
  cache:'no-store',signal:AbortSignal.timeout(20000)
 });
 const result=await response.json();
 if(!response.ok)throw new Error(result.error||'Handlingen kunne ikke gennemføres.');
 return result;
}

const admin=createAdmin({request});
const platform=createPlatformAdmin({request});
$('#auth-loading h2').textContent='Åbner systemadmin';
$('#auth-shell .brand').href='/';
$('#auth-shell [data-auth-mode="signup"]').hidden=true;
const back=document.createElement('a');
back.href='/';back.textContent='Til Pejlo';
$('#auth-shell .auth-card').append(back);

startAuthentication(async user=>{
 const current=++generation;
 session=user?.emailVerified?user:null;
 admin.clear();platform.enable(false);
 $('#tracker-admin').hidden=true;
 $('#provision-tracker').reset();
 $('#provision-tracker button').disabled=false;
 $('#provision-result').textContent='';
 $('#pairing-output').hidden=true;
 $('#pairing-link').value='';
 $('#pairing-qr').replaceChildren();
 $('#sync-state').textContent='';
 if(!session)return;
 $('#cloud-help').textContent='Tjekker din adgang…';
 try{
  await request('admin/access');
  if(current!==generation)return;
  admin.enable(true);platform.enable(true);
  $('#tracker-admin').hidden=false;
  $('#auth-shell').hidden=true;
  $('.admin-page').hidden=false;
  $('#sync-state').textContent='Systemadmin';
 }catch(error){if(current===generation)$('#cloud-help').textContent=error.message;}
},{administration:true}).catch(()=>{$('#auth-message').textContent='Login kunne ikke startes.';});

$('#provision-tracker').onsubmit=async event=>{
 event.preventDefault();
 const button=event.target.querySelector('button');
 button.disabled=true;
 const current=generation;
 try{
  const result=await request('admin/trackers',{identifier:$('#provision-id').value.trim(),name:$('#provision-name').value.trim()});
  if(current!==generation)return;
  const message='Tracker-ID: '+result.identifier+' · Parringskode: '+result.code+' · Gem koden nu. Den vises kun denne gang.';
  $('#provision-result').textContent=message;
  const link=pairingLink(result.identifier,result.code,window.location.origin);
  $('#pairing-link').value=link;
  $('#pairing-output').hidden=false;
  const preview=document.createElement('div');
  $('#pairing-qr').replaceChildren(preview);
  try{await drawPairingQR(preview,link);}
  catch{if(current===generation)$('#provision-result').textContent=message+' QR-koden kunne ikke tegnes. Du kan stadig kopiere linket.';}
 }catch(error){if(current===generation)$('#provision-result').textContent=error.message;}
 finally{if(current===generation)button.disabled=false;}
};

$('#copy-pairing').onclick=async()=>{
 try{await navigator.clipboard.writeText($('#pairing-link').value);}
 catch{$('#pairing-link').select();}
};
