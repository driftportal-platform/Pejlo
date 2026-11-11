import {once} from './schema.js';
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
const MAX_PER_SENDER=10,MAX_PER_RECIPIENT=3,DAY=86400000;
const DEFAULT_APP_URL='https://pejlo.driftportal-platform.workers.dev';
export function mailReady(env){return typeof env.RESEND_API_KEY==='string'&&!!env.RESEND_API_KEY.trim()&&typeof env.MAIL_FROM==='string'&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.MAIL_FROM);}
// APP_URL is optional (set it when Pejlo gets its own domain). Only a plain https origin is accepted.
export const appURL=env=>typeof env.APP_URL==='string'&&/^https:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(env.APP_URL.trim())?env.APP_URL.trim():DEFAULT_APP_URL;
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
async function recipientHash(email){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(email).trim().toLowerCase()))),x=>x.toString(16).padStart(2,'0')).join('');}
export const ensureMail=db=>once(db,'mail',async()=>{
 for(const sql of [
  'CREATE TABLE IF NOT EXISTS pejlo_mail_limits(uid TEXT PRIMARY KEY,last_sent INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pejlo_mail_log(uid TEXT NOT NULL,recipient TEXT NOT NULL,sent_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS pejlo_mail_log_uid ON pejlo_mail_log(uid,sent_at)',
  'CREATE INDEX IF NOT EXISTS pejlo_mail_log_recipient ON pejlo_mail_log(recipient,sent_at)'
 ])await db.prepare(sql).run();
});
// Limits: one mail per minute and 10 per 24 hours per sender, and 3 per 24 hours per recipient.
// Recipients are stored only as a hash and the log is pruned after 24 hours.
export async function reserveInvitationMail(db,uid,now=Date.now(),email=''){
 await ensureMail(db);
 const since=now-DAY;
 await db.prepare('DELETE FROM pejlo_mail_log WHERE sent_at<?').bind(since).run();
 const recipient=email?await recipientHash(email):'';
 // The admission check and reservation are ONE SQLite write. This protects limits
 // across different Worker isolates, including different senders targeting one recipient.
 const result=await db.prepare(`INSERT INTO pejlo_mail_log(uid,recipient,sent_at)
 SELECT ?,?,?
 WHERE (SELECT COUNT(*) FROM pejlo_mail_log WHERE uid=? AND sent_at>=?)<?
 AND (?='' OR (SELECT COUNT(*) FROM pejlo_mail_log WHERE recipient=? AND sent_at>=?)<?)
 AND NOT EXISTS(SELECT 1 FROM pejlo_mail_log WHERE uid=? AND sent_at>=?)
 AND NOT EXISTS(SELECT 1 FROM pejlo_mail_limits WHERE uid=? AND last_sent>=?)
 RETURNING uid`).bind(uid,recipient,now,uid,since,MAX_PER_SENDER,recipient,recipient,since,MAX_PER_RECIPIENT,uid,now-60000,uid,now-60000).first();
 if(!result)fail(429,'Mailgrænsen er nået. Vent mindst ét minut; dagsgrænserne er 10 invitationer fra dig og 3 til samme modtager på 24 timer.');
}
export async function sendInvitationMail({email,code,name,inviter,role},env,fetcher=fetch){
 if(!mailReady(env))fail(503,'Invitationsmail mangler opsætning. Tilføj RESEND_API_KEY og MAIL_FROM i Cloudflare.');
 const link=appURL(env)+'/#invitation='+encodeURIComponent(code),from=clean(inviter,80);
 const intro=from?from+' har inviteret dig til profilen '+clean(name,40)+' i Pejlo.':'Du er inviteret til profilen '+clean(name,40)+' i Pejlo.';
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'pejlo-invite-'+code},body:JSON.stringify({from:`Pejlo <${env.MAIL_FROM}>`,to:[email],subject:'Du er inviteret til en delt profil i Pejlo',text:intro+'\n\nÅbn invitationen:\n'+link+'\n\nLog ind eller opret en konto med denne e-mailadresse, og bekræft din e-mail. Tryk derefter Tilføj delt profil. Du kan også indtaste koden under Indstillinger:\n'+code+'\n\nInvitationen gælder i 7 dage og kan kun bruges af denne e-mailadresse. '+(role==='viewer'?'Delingen giver adgang til at se position og historik, men ikke til at ændre profil eller geofences.':'Delingen giver adgang til position og historik samt redigering af profil og geofences.')+'\n\nHvis du ikke kender afsenderen eller ikke forventede denne invitation, kan du ignorere mailen.'})});
 if(!response.ok)fail(502,'Mailtjenesten kunne ikke modtage invitationen.');
 const result=await response.json();if(typeof result.id!=='string')fail(502,'Mailtjenesten bekræftede ikke afsendelsen.');return {accepted:true};
}
