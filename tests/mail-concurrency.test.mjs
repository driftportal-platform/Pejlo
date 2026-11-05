import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {reserveInvitationMail} from '../apps/api/mail.js';
function database(){
 const raw=new DatabaseSync(':memory:');return {raw,prepare(sql){const stmt=raw.prepare(sql);let args=[];return{bind(...v){args=v;return this;},async run(){await new Promise(r=>setImmediate(r));stmt.run(...args);},async first(){await new Promise(r=>setImmediate(r));return stmt.get(...args)||null;}};}};
}
const successes=results=>results.filter(r=>r.status==='fulfilled').length;
test('simultaneous senders cannot exceed the shared recipient limit',async()=>{
 const db=database(),now=Date.now();
 const results=await Promise.allSettled(Array.from({length:12},(_,i)=>reserveInvitationMail(db,'owner'+i,now,'member@example.com')));
 assert.equal(successes(results),3);assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM pejlo_mail_log').get().n,3);
 for(const r of results)if(r.status==='rejected')assert.equal(r.reason.status,429);
});
test('only one concurrent reservation fits the last remaining recipient slot',async()=>{
 const db=database(),now=Date.now();await reserveInvitationMail(db,'seed1',now-120000,'m@example.com');await reserveInvitationMail(db,'seed2',now-61000,'m@example.com');
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>reserveInvitationMail(db,'owner'+i,now,'M@example.com')));assert.equal(successes(results),1);
});
test('concurrent requests by the same sender cannot bypass cooldown or daily limit',async()=>{
 const db=database(),now=Date.now();for(let i=0;i<9;i++)await reserveInvitationMail(db,'owner',now-(10-i)*61000,'m'+i+'@example.com');
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>reserveInvitationMail(db,'owner',now,'new'+i+'@example.com')));assert.equal(successes(results),1);
 await assert.rejects(()=>reserveInvitationMail(db,'owner',now+61000,'another@example.com'),e=>e.status===429);
 // A rejected reservation leaves no extra entries; slots become available after 24h.
 assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM pejlo_mail_log').get().n,10);await reserveInvitationMail(db,'owner',now+86400001,'another@example.com');
});
test('upgrading respects the last reservation recorded by older versions',async()=>{
 const db=database(),now=Date.now();db.raw.exec('CREATE TABLE pejlo_mail_limits(uid TEXT PRIMARY KEY,last_sent INTEGER NOT NULL)');db.raw.prepare('INSERT INTO pejlo_mail_limits VALUES(?,?)').run('owner',now);
 await assert.rejects(()=>reserveInvitationMail(db,'owner',now+1,'m@example.com'),e=>e.status===429);await reserveInvitationMail(db,'owner',now+60001,'m@example.com');
});
