import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sendInvitationMail,reserveInvitationMail,mailReady} from '../apps/api/mail.js';
const env={RESEND_API_KEY:'server-only-key',MAIL_FROM:'pejlo@example.com'},invitation={email:'member@example.com',code:'a'.repeat(32),name:'Loui'};
test('mail uses fixed provider, server credentials, single recipient and fragment invitation link',async()=>{
 let captured;await sendInvitationMail(invitation,env,async(url,options)=>{captured={url,options};return Response.json({id:'email-id'});});
 assert.equal(captured.url,'https://api.resend.com/emails');assert.equal(captured.options.redirect,'manual');assert.equal(captured.options.headers.Authorization,'Bearer server-only-key');const body=JSON.parse(captured.options.body);assert.equal(body.from,'Pejlo <pejlo@example.com>');assert.deepEqual(body.to,['member@example.com']);assert.match(body.text,/#invitation=aaaaaaaa/);assert.match(body.text,/Tilføj delt profil/);assert.ok(!captured.options.body.includes('server-only-key'));
});
test('missing mail setup and failed delivery never report success',async()=>{
 assert.equal(mailReady({}),false);assert.equal(mailReady({...env,MAIL_FROM:'x\r\nbcc:other@example.com'}),false);
 await assert.rejects(()=>sendInvitationMail(invitation,{},()=>{throw Error('must not call');}),e=>e.status===503);
 for(const response of [()=>new Response('',{status:403}),()=>new Response('',{status:302}),()=>Response.json({})])await assert.rejects(()=>sendInvitationMail(invitation,env,async()=>response()),e=>e.status===502);
});
test('mail reservation enforces per-user cooldown atomically',async()=>{
 const raw=new DatabaseSync(':memory:');const db={prepare(q){const stmt=raw.prepare(q);let args=[];return {bind(...v){args=v;return this;},async run(){stmt.run(...args);},async first(){return stmt.get(...args);}};}};
 await reserveInvitationMail(db,'owner',100000);await assert.rejects(()=>reserveInvitationMail(db,'owner',100001),e=>e.status===429);await reserveInvitationMail(db,'another',100001);await reserveInvitationMail(db,'owner',160001);
});
