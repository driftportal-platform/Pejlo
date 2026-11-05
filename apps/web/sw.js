// Notifications only: never cache private API responses or profile data.
self.addEventListener('push',event=>{let payload={};try{payload=event.data.json();}catch{}event.waitUntil(self.registration.showNotification(payload.title||'Pejlo',{body:payload.body||'Der er nyt i Pejlo.',tag:payload.tag||'pejlo',data:{url:'/#kort'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{const target=windows.find(w=>new URL(w.url).origin===self.location.origin);if(target){await target.navigate('/#kort');return target.focus();}return clients.openWindow('/#kort');}));});
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));
