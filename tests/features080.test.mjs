import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {homeStatus,recentMovement} from '../packages/shared/status.js';
import {PROFILE_PHOTO_LIMIT,validPhoto,cleanProfile} from '../packages/shared/profiles.js';
import {photoCrop} from '../dist/src/features/photo.js';
import {createWakeLock} from '../apps/web/src/features/wake-lock.js';
import {archiveEvent,archiveStatus,listAlarms} from '../apps/api/archive.js';
const now=Date.now(),home={lat:56,lon:8,radius:100,shape:'circle'},profile={id:'loui',name:'Loui',type:'cat',home,homeConfirmed:true};
test('home status distinguishes old observations from fresh fixes and unconfigured areas',()=>{
 assert.equal(homeStatus(profile,{lat:56,lon:8,timestamp:now-301000},now),'Sidst set hjemme');
 assert.equal(homeStatus(profile,{lat:57,lon:8,timestamp:now-301000},now),'Sidst set uden for hjemmeområdet');
 assert.equal(homeStatus(profile,{lat:56,lon:8,timestamp:now},now),'Senest registreret i hjemmeområdet');
 assert.equal(homeStatus({...profile,homeConfirmed:false},null,now),'Intet hjemmeområde valgt');
 assert.equal(homeStatus(profile,null,now),'Afventer gyldig GPS-position');
});
const route=[0,1,2].map(i=>({lat:56+i*.0002,lon:8,timestamp:now-60000+i*30000,accuracy:5}));
test('movement requires several recent consistent fixes and rejects drift, gaps and poor accuracy',()=>{
 const r=recentMovement(route,route.at(-1),now);assert.equal(r.direction,'nord');assert.ok(r.meters>40);
 assert.equal(recentMovement(route.slice(1),route.at(-1),now),null);
 assert.equal(recentMovement(route,route.at(-1),now+301000),null);
 const drift=route.map((p,i)=>({...p,lat:56+i*.00001}));assert.equal(recentMovement(drift,drift.at(-1),now),null);
 const poor=route.map(p=>({...p,accuracy:40}));assert.equal(recentMovement(poor,poor.at(-1),now),null);
 const turn=route.map((p,i)=>({...p,lat:56+[0,.0008,.0003][i]}));assert.equal(recentMovement(turn,turn.at(-1),now),null);
 const gap=route.map((p,i)=>({...p,timestamp:now-[180000,10000,0][i]}));assert.equal(recentMovement(gap,gap.at(-1),now),null);
});
test('profile photos survive cleaning; external URLs, SVG and oversized images are stripped',()=>{
 const photo='data:image/jpeg;base64,/9j/AAAA';assert.equal(cleanProfile({...profile,photo}).photo,photo);
 const largerPhoto='data:image/jpeg;base64,'+'A'.repeat(14000);assert.equal(cleanProfile({...profile,photo:largerPhoto}).photo,largerPhoto);
 for(const photo of ['https://example.com/track.jpg','data:image/svg+xml;base64,AAAA','data:image/jpeg;base64,'+'A'.repeat(PROFILE_PHOTO_LIMIT)]){assert.equal(validPhoto(photo),false);assert.equal(cleanProfile({...profile,photo}).photo,'');}
});
test('photo cropping keeps portrait and landscape selections inside the source image',()=>{
 assert.deepEqual(photoCrop(1200,800,1,600,400),{size:800,x:200,y:0});
 assert.deepEqual(photoCrop(800,1200,1,400,600),{size:800,x:0,y:200});
 assert.deepEqual(photoCrop(1200,800,2,0,800),{size:400,x:0,y:400});
 assert.deepEqual(photoCrop(800,1200,4,800,0),{size:200,x:600,y:0});
});
function lock(){const listeners=[];return {released:false,addEventListener(_,fn){listeners.push(fn);},async release(){this.released=true;listeners.forEach(fn=>fn());}};}
test('wake lock only runs in Find, reacquires on visibility and releases on leaving/logout',async()=>{
 const handles=[],messages=[];let visible=true;const wake=createWakeLock({api:{async request(type){assert.equal(type,'screen');const h=lock();handles.push(h);return h;}},visible:()=>visible,onState:s=>messages.push(s)});
 await wake.set(true);assert.equal(handles.length,0);await wake.page(true);assert.equal(handles.length,1);
 visible=false;await wake.visibility();assert.equal(handles[0].released,true);visible=true;await wake.visibility();assert.equal(handles.length,2);
 await wake.page(false);assert.equal(handles[1].released,true);await wake.stop();await wake.page(true);assert.equal(handles.length,2);
});
test('a late wake-lock grant after cancellation is immediately released',async()=>{
 let grant;const handle=lock(),wake=createWakeLock({api:{request:()=>new Promise(r=>grant=r)},visible:()=>true});await wake.page(true);
 const pending=wake.set(true);await new Promise(r=>setImmediate(r));await wake.stop();grant(handle);await pending;assert.equal(handle.released,true);
});
function database(){const raw=new DatabaseSync(':memory:');return {prepare(sql){const stmt=raw.prepare(sql);let args=[];return{bind(...v){args=v;return this;},async run(){stmt.run(...args);},async all(){return {results:stmt.all(...args)};}};}};}
test('archive keeps original area and delivery state, with user isolation and stable same-time pagination',async()=>{
 const db=database(),area={name:'Haven',home:{...home}};
 for(let i=0;i<105;i++)await archiveEvent(db,{id:String(i).padStart(3,'0'),identifier:'1234',uid:'owner',kind:'exit',payload:{body:'Loui forlod Haven'},area,createdAt:now});
 area.name='Ændret';area.home.radius=999;await archiveStatus(db,'104','accepted');
 const first=await listAlarms(db,'1234','owner');assert.equal(first.events.length,100);assert.equal(first.events[0].push_status,'accepted');assert.equal(first.events[0].area.name,'Haven');assert.equal(first.events[0].area.home.radius,100);
 const second=await listAlarms(db,'1234','owner',first.next.before,first.next.beforeId);assert.equal(second.events.length,5);assert.equal(second.next,null);assert.equal(new Set([...first.events,...second.events].map(e=>e.id)).size,105);
 assert.equal((await listAlarms(db,'1234','stranger')).events.length,0);assert.equal((await listAlarms(db,'other','owner')).events.length,0);
 await archiveEvent(db,{id:'old',identifier:'1234',uid:'owner',kind:'exit',payload:{},createdAt:now-91*86400000});assert.equal((await listAlarms(db,'1234','owner')).events.length,100);
});
