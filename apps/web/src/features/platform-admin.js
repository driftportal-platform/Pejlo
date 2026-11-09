const statusLabel={none:'Intet abonnement',trial:'Prøveperiode',active:'Aktivt',paused:'Sat på pause',expired:'Udløbet'};

export function createPlatformAdmin({request}){
 const $=id=>document.getElementById('platform-'+id);
 const users=new Map();
 let allowed=false,generation=0,selected=null,cursor=null,email='',busy=false;

 function enable(value){
  allowed=value;
  if(value)return;
  generation++;
  users.clear();selected=null;cursor=null;email='';busy=false;
  for(const id of ['search','create','account','subscription'])$(id).reset();
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
  $('plan').value=user.subscription.plan;
  $('stage').value=user.subscription.stage;
  $('expiry').value=user.subscription.expiresOn;
 }

 function render(){
  $('users').replaceChildren();
  for(const user of users.values()){
   const button=document.createElement('button');
   button.type='button';button.className='outline-button platform-user';
   const subscription=user.subscription;
   button.textContent=(user.name?user.name+' · ':'')+(user.email||user.uid)+' · '+
     [subscription.plan,statusLabel[subscription.status],subscription.expiresOn,user.disabled?'Login spærret':''].filter(Boolean).join(' · ');
   button.setAttribute('aria-pressed',String(user.uid===selected));
   button.onclick=()=>{
    choose(user.uid);
    for(const row of $('users').children)row.setAttribute('aria-pressed',String(row===button));
   };
   $('users').append(button);
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
 $('subscription').onsubmit=event=>{event.preventDefault();run(async active=>{
  const uid=selected,stage=$('stage').value;
  const result=await request('admin/users',{action:'subscription',uid,stage,
   plan:stage==='none'?'':$('plan').value,expiresOn:stage==='none'?'':$('expiry').value});
  if(!active())return;
  users.get(uid).subscription=result.subscription;
  render();
  if(selected===uid){$('plan').value=result.subscription.plan;$('expiry').value=result.subscription.expiresOn;}
  $('message').textContent='Abonnement gemt.';
 });};
 return {enable};
}
