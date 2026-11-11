import {subscriptionRates as standardPrices,standardSubscriptionPrice,subscriptionSavings} from '../shared/pricing.js';
const statusLabel={none:'Intet abonnement',trial:'Prøveperiode',active:'Aktivt',paused:'Sat på pause',expired:'Udløbet'};

const priceFormat=new Intl.NumberFormat('da-DK',{style:'currency',currency:'DKK'});
const trackerPrice=34900;
const kroner=ore=>priceFormat.format(ore/100);
const priceInput=ore=>(ore/100).toFixed(2).replace('.',',');
const dateFormat=new Intl.DateTimeFormat('da-DK',{dateStyle:'short',timeZone:'UTC'});
const cycleLabel={monthly:'pr. måned',annual:'pr. 12 mdr.',biennial:'pr. 24 mdr.'};
const cycles=Object.keys(standardPrices);

function timeLeft(days){
 if(days===null)return '—';
 if(days===0)return 'Udløber i dag';
 if(days<0)return 'Udløbet';
 return days+(days===1?' dag':' dage');
}

export function createPlatformAdmin({request}){
 const $=id=>document.getElementById('platform-'+id);
 const users=new Map();
 let allowed=false,generation=0,selected=null,cursor=null,email='',busy=false;
 for(const [label,key] of [['Første tracker','first'],['Hver ekstra tracker','extra']]){
  const row=$('catalog').insertRow();
  row.insertCell().textContent=label;
  for(const cycle of cycles){
   const rate=standardPrices[cycle],saving=standardPrices.monthly[key]*rate.months-rate[key];
   row.insertCell().textContent=kroner(rate[key])+(saving?' · spar '+kroner(saving):'');
  }
 }
 $('hardware').textContent='Klargjort Q8 4G: '+kroner(trackerPrice)+' · Startpakke med én tracker og ét år: '+kroner(trackerPrice+standardPrices.annual.first)+'. Priser inkl. moms. SIM, data og evt. fragt betales særskilt.';

 function preview(){
  const quantity=$('quantity').valueAsNumber;
  const valid=standardSubscriptionPrice('monthly',quantity)!==null;
  for(const cycle of cycles)$(cycle).disabled=!valid;
  $('price-preview').textContent=!valid?'Vælg et helt antal fra 1 til 1.000.':
   cycles.map(cycle=>{
    const total=kroner(standardSubscriptionPrice(cycle,quantity));
    const saving=subscriptionSavings(cycle,quantity);
    return total+' '+cycleLabel[cycle]+(saving?' (spar '+kroner(saving)+')':'');
   }).join(' · ') + '. Tryk Gem abonnement for at bruge prisen.';
 }
 $('quantity').oninput=preview;
 for(const cycle of cycles)$(cycle).onclick=()=>{
  const quantity=$('quantity').valueAsNumber,price=standardSubscriptionPrice(cycle,quantity);
  if(price===null)return;
  $('plan').value='Pejlo · '+quantity+(quantity===1?' tracker':' trackere');
  if($('stage').value==='none')$('stage').value='active';
  $('price').value=priceInput(price);
  $('cycle').value=cycle;
 };
 preview();

 function enable(value){
  allowed=value;
  if(value)return;
  generation++;
  users.clear();selected=null;cursor=null;email='';busy=false;
  for(const id of ['search','create','account','subscription','delete'])$(id).reset();
  $('create-panel').open=false;
  $('message').textContent='';
  render();
 }

 function choose(uid){
  selected=uid;
  const user=users.get(uid);
  if(!user){$('detail').hidden=true;return;}
  $('detail').hidden=false;
  $('user-title').textContent=user.email||user.uid;
  $('user-meta').textContent=(user.isAdmin?'Systemadmin':'Almindelig bruger')+
    ' · '+(user.verified?'E-mail bekræftet':'E-mail afventer bekræftelse');
  $('user-name').value=user.name;
  $('user-access').value=user.disabled?'disabled':'enabled';
  $('user-access').disabled=user.isAdmin;
  const stripe=user.subscription.managed;
  $('subscription').hidden=stripe;
  $('managed-subscription').hidden=!stripe;
  $('delete-panel').hidden=user.isAdmin||!user.email||stripe;
  $('delete-panel').open=false;
  $('delete').reset();
  const quantity=user.subscription.plan.match(/^Pejlo · (\d+) tracker(?:e)?$/);
  $('quantity').value=quantity?.[1]||1;
  preview();
  $('plan').value=user.subscription.plan;
  $('stage').value=user.subscription.stage;
  $('expiry').value=user.subscription.expiresOn;
  showPricing(user.subscription);
 }

 function showPricing(subscription){
  $('price').value=subscription.priceOre===null?'':priceInput(subscription.priceOre);
  $('cycle').value=subscription.billingCycle;
 }

 function render(){
  const rows=$('users');
  rows.replaceChildren();
  $('overview').hidden=!users.size;
  const ordered=[...users.values()].sort((a,b)=>
   (a.subscription.expiresOn||'9999').localeCompare(b.subscription.expiresOn||'9999'));
  for(const user of ordered){
   const row=rows.insertRow();
   const customer=row.insertCell();
   const button=document.createElement('button');
   button.type='button';button.className='text-button platform-user';
   button.textContent=user.name?user.name+' · '+user.email:user.email||user.uid;
   button.setAttribute('aria-pressed',String(user.uid===selected));
   button.onclick=()=>{
    choose(user.uid);
    for(const control of rows.querySelectorAll('button'))control.setAttribute('aria-pressed',String(control===button));
    $('user-title').focus();
   };
   customer.append(button);
   const subscription=user.subscription;
   row.insertCell().textContent=[subscription.plan,statusLabel[subscription.status],subscription.provider==='stripe'?'Stripe':'',subscription.cancelAtEnd?'Opsagt ved periodens udløb':''].filter(Boolean).join(' · ');
   row.insertCell().textContent=subscription.priceOre===null?'—':
    priceFormat.format(subscription.priceOre/100)+' '+cycleLabel[subscription.billingCycle];
   row.insertCell().textContent=subscription.expiresOn?dateFormat.format(new Date(subscription.expiresOn)):'—';
   row.insertCell().textContent=timeLeft(subscription.daysToExpiry);
  }
  $('more').hidden=!cursor;
  if(!users.has(selected))choose(null);
 }

 async function run(action){
  if(!allowed||busy)return;
  const current=++generation;
  const active=()=>current===generation;
  busy=true;$('message').textContent='Arbejder…';
  try{await action(active);}
  catch(error){if(active())$('message').textContent=error.message;}
  finally{if(active())busy=false;}
 }

 async function list(active,append=false,queryEmail=email){
  const params=new URLSearchParams();
  if(queryEmail)params.set('email',queryEmail);
  if(append&&cursor)params.set('cursor',cursor);
  const result=await request('admin/users?'+params);
  if(!active())return;
  if(!append){users.clear();email=queryEmail;}
  for(const user of result.users)users.set(user.uid,user);
  cursor=result.nextCursor;
  render();
  if(!append)choose(selected);
  $('message').textContent=users.size?'Viser '+users.size+' brugere'+(cursor?' · flere kan hentes.':'.'):'Ingen brugere fundet.';
 }

 $('search').onsubmit=event=>{event.preventDefault();run(active=>{
  const nextEmail=$('search-email').value.trim();
  return list(active,false,nextEmail);
 });};
 $('more').onclick=()=>run(active=>list(active,true));
 $('create').onsubmit=event=>{event.preventDefault();run(async active=>{
  const result=await request('admin/users',{action:'create',name:$('create-name').value,email:$('create-email').value});
  if(!active())return;
  $('create').reset();
  $('create-panel').open=false;
  email=result.user.email;$('search-email').value=email;
  users.clear();cursor=null;
  users.set(result.user.uid,result.user);
  choose(result.user.uid);render();
  $('message').textContent='Konto oprettet. Brugeren kan vælge Glemt adgangskode? ved login og derefter bekræfte sin e-mail.';
 });};
 $('account').onsubmit=event=>{event.preventDefault();run(async active=>{
  const uid=selected;
  const result=await request('admin/users',{action:'account',uid,name:$('user-name').value,disabled:$('user-access').value==='disabled'});
  if(!active())return;
  Object.assign(users.get(uid),result);
  render();
  if(selected===uid)$('user-name').value=result.name;
  $('message').textContent='Konto gemt.';
 });};
 $('delete').onsubmit=event=>{event.preventDefault();run(async active=>{
  const uid=selected;
  const user=users.get(uid);
  if(!user.disabled){$('message').textContent='Sæt login på pause og gem kontoen først.';return;}
  await request('admin/users',{action:'delete',uid,confirmEmail:$('delete-email').value});
  if(!active())return;
  users.delete(uid);
  if(selected===uid){choose(null);$('delete').reset();}
  render();
  $('message').textContent='Kundens login er slettet.';
 });};
 $('subscription').onsubmit=event=>{event.preventDefault();run(async active=>{
  const uid=selected,stage=$('stage').value;
  const result=await request('admin/users',{action:'subscription',uid,stage,
   plan:stage==='none'?'':$('plan').value,expiresOn:stage==='none'?'':$('expiry').value,
   price:stage==='none'?'':$('price').value.trim(),billingCycle:stage==='none'?'':$('cycle').value});
  if(!active())return;
  users.get(uid).subscription=result.subscription;
  render();
  if(selected===uid){$('plan').value=result.subscription.plan;$('expiry').value=result.subscription.expiresOn;showPricing(result.subscription);}
  $('message').textContent='Abonnement gemt.';
 });};
 return {enable};
}
