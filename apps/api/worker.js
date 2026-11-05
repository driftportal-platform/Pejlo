import {firebaseConfig} from '../web/src/config/firebase.js';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class Failure extends Error { constructor(status,message){super(message);this.status=status;} }
async function checkedJSON(response){if(!response.ok)throw new Failure(502,'Traccar kunne ikke kontaktes. Kontrollér forbindelsen og adgangstokenet.');return response.json();}
export function point(raw){
 const timestamp=Date.parse(raw?.fixTime);
 if(raw?.valid!==true||typeof raw.latitude!=='number'||typeof raw.longitude!=='number'||!Number.isFinite(raw.latitude)||!Number.isFinite(raw.longitude)||Math.abs(raw.latitude)>90||Math.abs(raw.longitude)>180||!Number.isFinite(timestamp)||timestamp>Date.now()+60000)return null;
 const battery=raw.attributes?.batteryLevel;
 return {lat:raw.latitude,lon:raw.longitude,timestamp,battery:typeof battery==='number'&&battery>=0&&battery<=100?battery:null,valid:true};
}
const identifierOK=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{4,100}$/.test(value);
export async function codeHash(code){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code.trim().toUpperCase()))),x=>x.toString(16).padStart(2,'0')).join('');}
async function body(request){if(Number(request.headers.get('content-length')||0)>2048)throw new Failure(400,'For mange oplysninger.');const text=await request.text();if(text.length>2048)throw new Failure(400,'For mange oplysninger.');try{return JSON.parse(text);}catch{throw new Failure(400,'Oplysningerne kunne ikke læses.');}}
export async function handleAPI(request,env,fetcher=fetch){
 try{
  const url=new URL(request.url),path=url.pathname;
  const routes={'/api/tracker':'GET','/api/trackers':'GET','/api/trackers/claim':'POST','/api/admin/trackers':'POST'};
  if(!routes[path])return json({error:'Ikke fundet.'},404);
  if(request.method!==routes[path])return json({error:'Metoden er ikke tilladt.'},405);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Adgang afvist.'},403);
  const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!token||token.length>12000)return json({error:'Log ind igen.'},401);
  let lookup;
  try{lookup=await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),redirect:'error',signal:AbortSignal.timeout(10000)});}catch{throw new Failure(503,'Loginserveren kunne ikke kontaktes. Prøv igen.');}
  if(!lookup.ok){if(lookup.status>=500)throw new Failure(503,'Loginserveren er midlertidigt utilgængelig.');throw new Failure(401,'Log ind igen.');}
  const account=(await lookup.json()).users?.[0];
  if(!account?.localId||account.disabled||account.emailVerified!==true)throw new Failure(403,'Bekræft din e-mail, og log ind igen.');
  if(!env.DB)throw new Failure(503,'Trackerregisteret mangler opsætning i Cloudflare.');
  const uid=account.localId,isAdmin=!!env.TRACCAR_ADMIN_UID&&uid===env.TRACCAR_ADMIN_UID;
  if(path==='/api/trackers'){
   const rows=await env.DB.prepare('SELECT identifier, name FROM trackers WHERE owner_uid = ? ORDER BY name').bind(uid).all();
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
  const traccar=async(path,options={})=>checkedJSON(await fetcher(base+path,{...options,headers:{Authorization:`Bearer ${env.TRACCAR_TOKEN}`,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},redirect:'error',signal:AbortSignal.timeout(12000)}));
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
  const identifier=url.searchParams.get('identifier');
  if(!identifierOK(identifier))throw new Failure(400,'Vælg en tilknyttet tracker.');
  const owned=await env.DB.prepare('SELECT identifier FROM trackers WHERE identifier = ? AND owner_uid = ?').bind(identifier,uid).first();
  if(!owned)throw new Failure(403,'Trackeren er ikke tilknyttet din konto.');
  const devices=await traccar('/api/devices?uniqueId='+encodeURIComponent(identifier));
  const device=Array.isArray(devices)?devices.find(d=>d.uniqueId===identifier):null;
  if(!device||!Number.isSafeInteger(device.id))throw new Failure(404,'Trackeren findes ikke på Traccar-kontoen.');
  const positions=device.positionId?await traccar('/api/positions?id='+encodeURIComponent(device.positionId)):[];
  const raw=Array.isArray(positions)?positions.find(p=>p.deviceId===device.id&&p.id===device.positionId):null;
  const position=point(raw);
  const now=new Date(),from=new Date(now);from.setUTCHours(0,0,0,0);
  let route=[],historyAvailable=true;
  try{
   const points=await traccar('/api/reports/route?'+new URLSearchParams({deviceId:String(device.id),from:from.toISOString(),to:now.toISOString()}));
   if(!Array.isArray(points))throw new Error();
   route=points.filter(p=>p.deviceId===device.id).map(point).filter(p=>p&&p.timestamp>=from.getTime()&&p.timestamp<=now.getTime()).sort((a,b)=>a.timestamp-b.timestamp).slice(-2000);
  }catch{historyAvailable=false;}
  return json({source:'traccar',device:{identifier,name:String(device.name||'Pejlo'),status:['online','offline','unknown'].includes(device.status)?device.status:'unknown'},position,route,historyAvailable,checkedAt:Date.now()});
 }catch(error){return json({error:error instanceof Failure?error.message:'Trackerdata kunne ikke hentes. Prøv igen.'},error instanceof Failure?error.status:502);}
}
export default {fetch(request,env){return new URL(request.url).pathname.startsWith('/api/')?handleAPI(request,env):env.ASSETS.fetch(request);}};
