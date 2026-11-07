import {trustedGps,gpsPoint} from './gps.js';
import {filterGps} from '../../packages/shared/gps-filter.js';
import {adminStatus} from './operations.js';
import {snoozeUntil,setSnooze} from './snooze.js';
import {listAlarms} from './archive.js';
import {mailReady,reserveInvitationMail,sendInvitationMail} from './mail.js';
import {ensureFamily,trackerAccess,familyAPI} from './family.js';
import {cleanAlerts} from '../../packages/shared/alerts.js';
import {historyRange,danishDate} from '../../packages/shared/history.js';
import {ensureNotifications,pushReady,validSubscription,validHome,sendPush,runNotifications} from './notifications.js';
import {firebaseConfig} from '../web/src/config/firebase.js';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class Failure extends Error { constructor(status,message){super(message);this.status=status;} }
async function checkedJSON(response){if(!response.ok)throw new Failure(502,'Traccar kunne ikke kontaktes. Kontrollér forbindelsen og adgangstokenet.');return response.json();}
export const point=gpsPoint;
const identifierOK=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{4,100}$/.test(value);
export async function codeHash(code){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code.trim().toUpperCase()))),x=>x.toString(16).padStart(2,'0')).join('');}
async function body(request,limit=12000){if(Number(request.headers.get('content-length')||0)>limit)throw new Failure(400,'For mange oplysninger.');const text=await request.text();if(text.length>limit)throw new Failure(400,'For mange oplysninger.');try{return JSON.parse(text);}catch{throw new Failure(400,'Oplysningerne kunne ikke læses.');}}
export async function handleAPI(request,env,fetcher=fetch){
 try{
  const url=new URL(request.url),path=url.pathname;
  const routes={'/api/admin/status':'GET','/api/snooze':'GETPOST','/api/alarms':'GET','/api/family':'GETPOST','/api/alerts':'GETPOST','/api/fence':'POST','/api/push/config':'GET','/api/push/subscribe':'POST','/api/push/remove':'POST','/api/push/test':'POST','/api/tracker':'GET','/api/tracker/position':'POST','/api/trackers':'GET','/api/trackers/claim':'POST','/api/admin/trackers':'POST'};
  if(!routes[path])return json({error:'Ikke fundet.'},404);
  if(!(routes[path]==='GETPOST'?['GET','POST'].includes(request.method):request.method===routes[path]))return json({error:'Metoden er ikke tilladt.'},405);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Adgang afvist.'},403);
  const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!token||token.length>12000)return json({error:'Log ind igen.'},401);
  let lookup;
  try{lookup=await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),redirect:'manual',signal:AbortSignal.timeout(10000)});}catch{throw new Failure(503,'Loginserveren kunne ikke kontaktes. Prøv igen.');}
  if(!lookup.ok){if(lookup.status>=300&&lookup.status<400)throw new Failure(503,'Loginserveren svarede med en uventet viderestilling.');if(lookup.status>=500)throw new Failure(503,'Loginserveren er midlertidigt utilgængelig.');throw new Failure(401,'Log ind igen.');}
  const account=(await lookup.json()).users?.[0];
  if(!account?.localId||account.disabled||account.emailVerified!==true)throw new Failure(403,'Bekræft din e-mail, og log ind igen.');
  if(!env.DB)throw new Failure(503,'Trackerregisteret mangler opsætning i Cloudflare.');
  const uid=account.localId,isAdmin=!!env.TRACCAR_ADMIN_UID&&uid===env.TRACCAR_ADMIN_UID;
  if(path==='/api/admin/status'){
   if(!isAdmin)throw new Failure(403,'Kun administratoren kan se driftsstatus.');
   await ensureNotifications(env.DB);return json(await adminStatus(env));
  }
  if(path==='/api/snooze'){
   const input=request.method==='GET'?{identifier:url.searchParams.get('identifier')}:await body(request);
   if(!identifierOK(input.identifier)||!await trackerAccess(env.DB,input.identifier,uid))throw new Failure(403,'Du har ikke adgang til denne tracker.');
   const until=request.method==='POST'?await setSnooze(env.DB,input.identifier,uid,input.hours):await snoozeUntil(env.DB,input.identifier,uid);
   return json({until,serverTime:Date.now()});
  }
  if(path==='/api/alarms'){
   const identifier=url.searchParams.get('identifier');
   if(!identifierOK(identifier)||!await trackerAccess(env.DB,identifier,uid))throw new Failure(403,'Du har ikke adgang til denne tracker.');
   const before=url.searchParams.has('before')?Number(url.searchParams.get('before')):Date.now()+1,beforeId=url.searchParams.get('beforeId')||'~';
   if(!Number.isSafeInteger(before)||before<0||beforeId.length>400)throw new Failure(400,'Ugyldig side i alarmarkivet.');
   return json(await listAlarms(env.DB,identifier,uid,before,beforeId));
  }
  if(path==='/api/family'){
   await ensureNotifications(env.DB);const input=request.method==='GET'?null:await body(request,120000);
   if(input?.action==='invite'){
    if(!mailReady(env))throw new Failure(503,'Invitationsmail mangler opsætning. Tilføj RESEND_API_KEY og MAIL_FROM i Cloudflare.');
    const access=await trackerAccess(env.DB,input.identifier,uid);if(!access?.owner)throw new Failure(403,'Kun ejeren kan invitere.');
    await reserveInvitationMail(env.DB,uid,Date.now(),typeof input.email==='string'?input.email.trim().toLowerCase():'');
   }
   const result=await familyAPI(env.DB,account,input,codeHash);
   if(input?.action==='invite'){
    const row=await env.DB.prepare('SELECT profile FROM pejlo_profiles WHERE identifier=?').bind(input.identifier).first();
    try{await sendInvitationMail({email:input.email.trim().toLowerCase(),code:result.code,name:JSON.parse(row.profile).name,inviter:account.displayName||account.email,role:result.role},env,fetcher);return json({...result,mailSent:true});}
    catch{return json({...result,mailSent:false,message:'Invitationen er oprettet, men mailen kunne ikke bekræftes sendt. Du kan give koden til modtageren eller prøve igen om et minut.'});}
   }
   return json(result);
  }
  if(path==='/api/alerts'){
   await ensureNotifications(env.DB);const input=request.method==='GET'?{identifier:url.searchParams.get('identifier')}:await body(request);
   if(!identifierOK(input.identifier)||!await trackerAccess(env.DB,input.identifier,uid))throw new Failure(403,'Du har ikke adgang til denne tracker.');
   if(request.method==='POST'){
    const config=cleanAlerts(input.config);
    await env.DB.prepare("INSERT INTO pejlo_alerts(identifier,uid,config,state) VALUES(?,?,?,?) ON CONFLICT(identifier,uid) DO UPDATE SET config=excluded.config,state=excluded.state").bind(input.identifier,uid,JSON.stringify(config),JSON.stringify({started:Date.now()})).run();return json({saved:true,config});
   }
   const row=await env.DB.prepare('SELECT config FROM pejlo_alerts WHERE identifier=? AND uid=?').bind(input.identifier,uid).first();return json({config:cleanAlerts(row?JSON.parse(row.config):null)});
  }
  if(path.startsWith('/api/push/')||path==='/api/fence'){
   await ensureNotifications(env.DB);
   if(path==='/api/push/config')return json({ready:pushReady(env),publicKey:pushReady(env)?env.VAPID_PUBLIC_KEY:null});
   const input=await body(request);
   if(path==='/api/fence'){
    if(!identifierOK(input.identifier)||!validHome(input.home)||typeof input.name!=='string'||input.name.length>40||typeof input.enabled!=='boolean')throw new Failure(400,'Kontrollér hjemmeområdet.');
    const access=await trackerAccess(env.DB,input.identifier,uid);
    if(!access)throw new Failure(403,'Trackeren er ikke tilknyttet din konto.');
    if(!access.owner&&access.role==='viewer')throw new Failure(403,'Du har kun læseadgang til denne profil.');
    const trackerOwner=await env.DB.prepare('SELECT owner_uid FROM trackers WHERE identifier=?').bind(input.identifier).first();
    await ensureFamily(env.DB);if(await env.DB.prepare('SELECT identifier FROM pejlo_profiles WHERE identifier=?').bind(input.identifier).first())throw new Failure(409,'Gem området gennem den fælles profil.');
    const home={lat:input.home.lat,lon:input.home.lon,radius:input.home.radius,buffer:input.home.buffer??5,shape:input.home.shape,...(input.home.shape==='polygon'?{points:input.home.points.map(p=>({lat:p.lat,lon:p.lon}))}:{})};
    await env.DB.prepare("INSERT INTO pejlo_fences(identifier,owner_uid,name,config,enabled) VALUES(?,?,?,?,?) ON CONFLICT(identifier) DO UPDATE SET owner_uid=excluded.owner_uid,name=excluded.name,config=excluded.config,enabled=excluded.enabled,state='{}',checked_at=0").bind(input.identifier,trackerOwner.owner_uid,input.name,JSON.stringify(home),input.enabled?1:0).run();
    return json({saved:true});
   }
   if(!validSubscription(input.subscription))throw new Failure(400,'Browserens pushabonnement kunne ikke bruges.');
   const sub=input.subscription;
   if(path==='/api/push/remove'){await env.DB.prepare('DELETE FROM pejlo_push WHERE endpoint=? AND owner_uid=?').bind(sub.endpoint,uid).run();return json({removed:true});}
   if(!pushReady(env))throw new Failure(503,'Push mangler engangsopsætningen hos Pejlo.');
   if(path==='/api/push/test'){
    if(!await env.DB.prepare('SELECT endpoint FROM pejlo_push WHERE endpoint=? AND owner_uid=?').bind(sub.endpoint,uid).first())throw new Failure(403,'Aktivér først beskeder på denne enhed.');
    const result=await sendPush(sub,{title:'Pejlo',body:'Pushbeskeder virker på denne enhed.',tag:'pejlo-test',url:'/#indstillinger'},env,fetcher);
    if(!result.ok)throw new Failure(502,'Testbeskeden kunne ikke afleveres. Prøv at aktivere beskeder igen.');return json({sent:true});
   }
   const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM pejlo_push WHERE owner_uid=?').bind(uid).first();
   const existing=await env.DB.prepare('SELECT owner_uid FROM pejlo_push WHERE endpoint=?').bind(sub.endpoint).first();
   if(existing&&existing.owner_uid!==uid)throw new Failure(409,'Slå beskeder fra på den tidligere konto på denne enhed først.');
   if(!existing&&count.n>=5)throw new Failure(400,'Der er allerede fem enheder med beskeder på kontoen.');
   await env.DB.prepare('INSERT INTO pejlo_push(endpoint,owner_uid,subscription) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription WHERE owner_uid=excluded.owner_uid').bind(sub.endpoint,uid,JSON.stringify(sub)).run();return json({saved:true});
  }
  if(path==='/api/trackers'){
   await ensureFamily(env.DB);
   const rows=await env.DB.prepare('SELECT t.identifier,t.name,CASE WHEN t.owner_uid=? THEN 1 ELSE 0 END AS is_owner FROM trackers t WHERE t.owner_uid=? OR EXISTS(SELECT 1 FROM pejlo_members m JOIN pejlo_profiles p ON p.identifier=m.identifier AND p.owner_uid=t.owner_uid WHERE m.identifier=t.identifier AND m.uid=?) ORDER BY t.name').bind(uid,uid,uid).all();
   return json({trackers:rows.results,isAdmin,uid});
  }
  // Claiming is atomic: the database assigns one tracker to exactly one account.
  if(path==='/api/trackers/claim'){
   const input=await body(request);
   if(!identifierOK(input.identifier)||typeof input.code!=='string'||!/^[A-Z0-9-]{16,80}$/i.test(input.code))throw new Failure(400,'Kontrollér tracker-ID og parringskode.');
   const hash=await codeHash(input.code);
   const result=await env.DB.prepare('UPDATE trackers SET owner_uid = ?, claimed_at = CURRENT_TIMESTAMP WHERE identifier = ? AND code_hash = ? AND (owner_uid IS NULL OR owner_uid = ?) RETURNING identifier, name').bind(uid,input.identifier,hash,uid).first();
   if(!result)throw new Failure(400,'ID eller parringskode er forkert, eller trackeren er allerede tilknyttet en anden konto.');
   return json({tracker:result});
  }
  if(path==='/api/admin/trackers'&&!isAdmin)throw new Failure(403,'Kun administratoren kan oprette parringskoder.');
  if(!env.TRACCAR_TOKEN)throw new Failure(503,'Traccar-adgangsnøglen mangler i Cloudflare.');
  const base=env.TRACCAR_URL||'https://demo3.traccar.org';
  if(base!=='https://demo3.traccar.org')throw new Failure(503,'Testforbindelsen skal bruge https://demo3.traccar.org.');
  const traccarFetch=(path,options={})=>fetcher(base+path,{...options,headers:{Authorization:`Bearer ${env.TRACCAR_TOKEN}`,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},redirect:'manual',signal:AbortSignal.timeout(12000)});
  const traccar=async(path,options)=>checkedJSON(await traccarFetch(path,options));
  if(path==='/api/admin/trackers'){
   const input=await body(request);
   if(!identifierOK(input.identifier)||typeof input.name!=='string'||!input.name.trim()||input.name.length>60)throw new Failure(400,'Skriv tracker-ID og et navn på højst 60 tegn.');
   if(await env.DB.prepare('SELECT identifier FROM trackers WHERE identifier = ?').bind(input.identifier).first())throw new Failure(409,'Trackeren er allerede oprettet. Den eksisterende parringskode beholdes.');
   const devices=await traccar('/api/devices?uniqueId='+encodeURIComponent(input.identifier));
   let device=Array.isArray(devices)?devices.find(d=>d.uniqueId===input.identifier):null;
   if(!device)device=await traccar('/api/devices',{method:'POST',body:JSON.stringify({name:input.name.trim(),uniqueId:input.identifier})});
   if(!Number.isSafeInteger(device?.id))throw new Failure(502,'Trackeren kunne ikke oprettes i Traccar.');
   const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
   try{await env.DB.prepare('INSERT INTO trackers (identifier, name, code_hash) VALUES (?, ?, ?)').bind(input.identifier,input.name.trim(),await codeHash(code)).run();}catch{throw new Failure(409,'Trackeren kunne ikke oprettes i registeret. Den kan allerede være oprettet.');}
   return json({identifier:input.identifier,code},201);
  }
  const requestPosition=path==='/api/tracker/position';
  const identifier=requestPosition?(await body(request))?.identifier:url.searchParams.get('identifier');
  if(!identifierOK(identifier))throw new Failure(400,'Vælg en tilknyttet tracker.');
  const owned=await trackerAccess(env.DB,identifier,uid);
  if(!owned)throw new Failure(403,'Trackeren er ikke tilknyttet din konto.');
  if(requestPosition&&!owned.owner)throw new Failure(403,'Kun ejeren kan bede trackeren om en ny position.');
  const devices=await traccar('/api/devices?uniqueId='+encodeURIComponent(identifier));
  const device=Array.isArray(devices)?devices.find(d=>d.uniqueId===identifier):null;
  if(!device||!Number.isSafeInteger(device.id))throw new Failure(404,'Trackeren findes ikke på Traccar-kontoen.');
  if(requestPosition){
   if(device.status!=='online')throw new Failure(409,'Trackeren har ingen aktiv forbindelse. Prøv igen, når den er online.');
   const types=await traccar('/api/commands/types?'+new URLSearchParams({deviceId:String(device.id),textChannel:'false'}));
   if(!Array.isArray(types)||!types.some(command=>command.type==='positionSingle'))throw new Failure(409,'Traccar tilbyder ikke enkelt positionsrapport for denne tracker.');
   await env.DB.prepare('CREATE TABLE IF NOT EXISTS pejlo_position_requests (identifier TEXT PRIMARY KEY, requested_at INTEGER NOT NULL)').run();
   const requestedAt=Date.now();
   const reserved=await env.DB.prepare(`INSERT INTO pejlo_position_requests (identifier,requested_at) VALUES (?,?)
    ON CONFLICT(identifier) DO UPDATE SET requested_at=excluded.requested_at
    WHERE pejlo_position_requests.requested_at<=? RETURNING identifier`).bind(identifier,requestedAt,requestedAt-60000).first();
   if(!reserved)throw new Failure(429,'Vent et minut mellem forespørgsler.');
   const response=await traccarFetch('/api/commands/send',{method:'POST',body:JSON.stringify({
    deviceId:device.id,type:'positionSingle',textChannel:false,attributes:{noQueue:true}
   })});
   if(response.status===202)return json({status:'queued',requestedAt});
   if(!response.ok)throw new Failure(502,'Traccar kunne ikke sende positionsforespørgslen. Kontrollér trackerens forbindelse.');
   return json({status:'sent',requestedAt});
  }
  const positions=device.positionId?await traccar('/api/positions?id='+encodeURIComponent(device.positionId)):[];
  const raw=Array.isArray(positions)?positions.find(p=>p.deviceId===device.id&&p.id===device.positionId):null;
  let position=point(raw);
  const now=new Date();let range;try{range=historyRange(url.searchParams.get('from')||danishDate(),url.searchParams.get('to')||url.searchParams.get('from')||danishDate());}catch(e){throw new Failure(400,e.message);}const from=new Date(range.from),to=new Date(range.to);
  let route=[],historyAvailable=true,historyTruncated=false;
  try{
   const points=await traccar('/api/reports/route?'+new URLSearchParams({deviceId:String(device.id),from:from.toISOString(),to:to.toISOString()}));
   if(!Array.isArray(points))throw new Error();
   route=points.filter(p=>p.deviceId===device.id).map(point).filter(p=>p&&p.timestamp>=from.getTime()&&p.timestamp<=to.getTime()).sort((a,b)=>a.timestamp-b.timestamp);historyTruncated=route.length>10000;route=route.slice(-10000);
  }catch{historyAvailable=false;}
  await ensureFamily(env.DB);
  const profileRow=await env.DB.prepare('SELECT profile,owner_uid FROM pejlo_profiles WHERE identifier=?').bind(identifier).first();
  let profile;try{profile=JSON.parse(profileRow?.profile||'{}');}catch{}
  const type=profile?.type||'object',home=profile?.homeConfirmed===true?profile.home:null;
  const ownerRow=await env.DB.prepare('SELECT owner_uid FROM trackers WHERE identifier=?').bind(identifier).first();
  const filtered=filterGps(route,type,{},home),samples=[...route.filter(p=>p.timestamp>=Date.now()-300000),...(position?[position]:[])];
  // Historical queries must never rewind the shared live filter.
  const gps=await trustedGps(env.DB,identifier,ownerRow.owner_uid,samples,type,home);
  position=point(raw)?gps.trusted||null:null;route=filtered.points;
  return json({source:'traccar',device:{identifier,name:String(device.name||'Pejlo'),status:['online','offline','unknown'].includes(device.status)?device.status:'unknown',lastContact:Number.isFinite(Date.parse(device.lastUpdate))&&Date.parse(device.lastUpdate)<=Date.now()+60000?Date.parse(device.lastUpdate):null},position,route,gpsUncertain:!!gps.uncertain,gpsRejected:filtered.rejected,historyAvailable,historyTruncated,range:{from:from.toISOString(),to:to.toISOString()},checkedAt:Date.now()});
 }catch(error){return json({error:error.status?error.message:'Trackerdata kunne ikke hentes. Prøv igen.'},error.status||502);}
}
export default {scheduled(event,env,ctx){ctx.waitUntil(runNotifications(env));},fetch(request,env){return new URL(request.url).pathname.startsWith('/api/')?handleAPI(request,env):env.ASSETS.fetch(request);}};
