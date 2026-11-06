// Notifications only: never cache private API responses, credentials or profiles.
const trackerId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{4,100}$/.test(value)?value:null;
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data.json();}catch{}
 const tracker=trackerId(payload.tracker),limit=typeof Notification==='undefined'?0:Notification.maxActions||0;
 const actions=tracker?[{action:'map',title:'Vis på kort'},{action:'pause',title:'Pause 1 time…'}].slice(0,limit):[];
 event.waitUntil(self.registration.showNotification(payload.title||'Pejlo',{body:payload.body||'Der er nyt i Pejlo.',tag:payload.tag||'pejlo',actions,data:{tracker}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const tracker=trackerId(event.notification.data?.tracker),action=tracker&&event.action==='pause'?'pause':'map';
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true}),target=windows.find(w=>new URL(w.url).origin===self.location.origin);
  if(target){await target.focus();target.postMessage({type:'pejlo-open',tracker,action});return;}
  // The pause action opens a confirmation after login. No tokens or unauthenticated mutations in this worker.
  return clients.openWindow(tracker?'/?profil='+encodeURIComponent(tracker)+(action==='pause'?'&handling=pause#indstillinger':'#kort'):'/#kort');
 })());
});
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));
