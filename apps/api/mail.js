const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
export function mailReady(env){return typeof env.RESEND_API_KEY==='string'&&!!env.RESEND_API_KEY.trim()&&typeof env.MAIL_FROM==='string'&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.MAIL_FROM);}
export async function reserveInvitationMail(db,uid,now=Date.now()){
 await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_mail_limits(uid TEXT PRIMARY KEY,last_sent INTEGER NOT NULL)').run();
 const result=await db.prepare('INSERT INTO pejlo_mail_limits(uid,last_sent) VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET last_sent=excluded.last_sent WHERE last_sent<? RETURNING uid').bind(uid,now,now-60000).first();
 if(!result)fail(429,'Vent et minut før du sender en ny invitation.');
}
export async function sendInvitationMail({email,code,name},env,fetcher=fetch){
 if(!mailReady(env))fail(503,'Invitationsmail mangler opsætning. Tilføj RESEND_API_KEY og MAIL_FROM i Cloudflare.');
 const link='https://pejlo.driftportal-platform.workers.dev/#invitation='+encodeURIComponent(code);
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'pejlo-invite-'+code},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:'Du er inviteret til en delt profil i Pejlo',text:'Du er inviteret til profilen '+String(name).slice(0,40)+' i Pejlo.\n\nÅbn invitationen:\n'+link+'\n\nLog ind eller opret en konto med denne e-mailadresse, og bekræft din e-mail. Tryk derefter Tilføj delt profil. Du kan også indtaste koden under Indstillinger:\n'+code+'\n\nInvitationen gælder i 7 dage og kan kun bruges af denne e-mailadresse. Delingen giver adgang til position og historik samt redigering af profil og geofences.\n\nHvis du ikke forventede denne invitation, kan du ignorere mailen.'})});
 if(!response.ok)fail(502,'Mailtjenesten kunne ikke modtage invitationen.');
 const result=await response.json();if(typeof result.id!=='string')fail(502,'Mailtjenesten bekræftede ikke afsendelsen.');return {accepted:true};
}
