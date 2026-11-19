import {once} from './schema.js';
import {traccarOrigin} from './traccar-url.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const enc=new TextEncoder(),dec=new TextDecoder();
export const ensureServerConfig=db=>once(db,'server-config',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_server_config(id INTEGER PRIMARY KEY CHECK(id=1),config_value TEXT NOT NULL)').run());
async function row(env){await ensureServerConfig(env.DB);return (await env.DB.prepare('SELECT config_value FROM pejlo_server_config WHERE id=1').first())?.config_value||null;}
async function key(env){
 if(typeof env.TRACCAR_CONFIG_SECRET!=='string'||env.TRACCAR_CONFIG_SECRET.length<32)fail(503,'Tilføj først Cloudflare Secret TRACCAR_CONFIG_SECRET med mindst 32 tilfældige tegn.');
 return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(env.TRACCAR_CONFIG_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function seal(env,value){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('pejlo-server-v1')},await key(env),enc.encode(JSON.stringify(value)));
 return JSON.stringify({iv:Array.from(iv),data:Array.from(new Uint8Array(data))});
}
async function open(env,value){
 try{const v=JSON.parse(value);return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(v.iv),additionalData:enc.encode('pejlo-server-v1')},await key(env),new Uint8Array(v.data))));}
 catch{fail(503,'Den gemte serveropsætning kunne ikke åbnes. Kontrollér TRACCAR_CONFIG_SECRET.');}
}
export async function resolveTraccarEnv(env){
 if(!env.DB)return env;
 const value=await row(env);if(!value)return env;
 const config=await open(env,value);
 return {...env,TRACCAR_URL:config.url,TRACCAR_TOKEN:config.token,TRACCAR_SOURCE:config.source};
}
function candidate(input){
 const url=traccarOrigin({TRACCAR_URL:typeof input.url==='string'?input.url.trim():''});
 if(!input.url||!url)fail(400,'Brug en HTTPS-adresse uden sti, fx https://traccar.eksempel.dk.');
 const host=new URL(url).hostname;
 if(!host.includes('.')||host.includes(':')||/^[0-9.]+$/.test(host)||/(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host))fail(400,'Brug serverens offentlige DNS-navn med HTTPS.');
 if(typeof input.token!=='string'||!input.token.trim()||input.token.length>4096||/\s/.test(input.token.trim()))fail(400,'Indsæt et gyldigt API-token fra den valgte Traccar-server.');
 return {url,token:input.token.trim()};
}
async function probe(config,fetcher){
 try{
  const response=await fetcher(config.url+'/api/devices',{headers:{Authorization:'Bearer '+config.token,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(12000)});
  if(!response.ok)fail(502,response.status===401||response.status===403?'Traccar afviste tokenet eller kontoens rettigheder.':'Traccar kunne ikke testes. Kontrollér HTTPS og serveradressen.');
  const data=await response.json();
  if(!Array.isArray(data)||data.some(d=>!Number.isSafeInteger(d.id)||typeof d.uniqueId!=='string'))fail(502,'Serveren svarede ikke med en gyldig Traccar-enhedsliste.');
  return data.map(d=>({identifier:d.uniqueId,name:String(d.name||d.uniqueId).slice(0,100)}));
 }catch(error){if(error.status)throw error;fail(502,'Kunne ikke få forbindelse. Kontrollér offentligt HTTPS-navn, certifikat og token.');}
}
export async function serverConfigAPI(env,input,fetcher){
 if(!input){
  const value=await row(env),config=value?await open(env,value):null;
  return {url:config?.url||traccarOrigin(env),source:config?'admin':'environment',revision:config?.source||'environment',tokenConfigured:!!(config?.token||env.TRACCAR_TOKEN),canSave:typeof env.TRACCAR_CONFIG_SECRET==='string'&&env.TRACCAR_CONFIG_SECRET.length>=32};
 }
 if(!['test','activate'].includes(input.action))fail(400,'Vælg test eller aktivér.');
 const config=candidate(input),devices=await probe(config,fetcher);
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS trackers(identifier TEXT PRIMARY KEY,name TEXT NOT NULL,code_hash TEXT NOT NULL,owner_uid TEXT,claimed_at TEXT)').run();
 const linked=(await env.DB.prepare('SELECT identifier FROM trackers WHERE owner_uid IS NOT NULL').all()).results||[];
 const ids=new Set(devices.map(d=>d.identifier));
 const missing=linked.filter(d=>!ids.has(d.identifier)).map(d=>d.identifier);
 if(input.action==='test')return {ok:true,devices,missing};
 if(missing.length)fail(409,'Serveren mangler tilknyttede trackere: '+missing.join(', ')+'. Opret dem med samme unikke tracker-ID før aktivering.');
 // Activation repeats the connection test and compares the last observed revision.
 const old=await row(env),previous=old?await open(env,old):null;
 if(input.revision!==(previous?.source||'environment'))fail(409,'Servervalget er ændret. Hent status igen før aktivering.');
 const configValue=await seal(env,{...config,source:crypto.randomUUID()});
 let saved;
 if(old)saved=await env.DB.prepare('UPDATE pejlo_server_config SET config_value=? WHERE id=1 AND config_value=? RETURNING id').bind(configValue,old).first();
 else saved=await env.DB.prepare('INSERT OR IGNORE INTO pejlo_server_config(id,config_value) VALUES(1,?) RETURNING id').bind(configValue).first();
 if(!saved)fail(409,'Servervalget blev ændret samtidigt. Hent status igen.');
 return {ok:true,url:config.url,devices};
}
