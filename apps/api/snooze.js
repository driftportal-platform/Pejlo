import {once} from './schema.js';
export const ensureSnooze=db=>once(db,'snooze',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_snooze(identifier TEXT NOT NULL,uid TEXT NOT NULL,until_ms INTEGER NOT NULL,PRIMARY KEY(identifier,uid))').run());
export async function snoozeUntil(db,identifier,uid){await ensureSnooze(db);return (await db.prepare('SELECT until_ms FROM pejlo_snooze WHERE identifier=? AND uid=?').bind(identifier,uid).first())?.until_ms||0;}
export async function setSnooze(db,identifier,uid,hours,now=Date.now()){
 if(![0,1,4,12].includes(hours)){const e=Error('Vælg 1, 4 eller 12 timer, eller genoptag beskeder.');e.status=400;throw e;}
 await ensureSnooze(db);const until=hours?now+hours*3600000:0;
 await db.prepare('INSERT INTO pejlo_snooze(identifier,uid,until_ms) VALUES(?,?,?) ON CONFLICT(identifier,uid) DO UPDATE SET until_ms=excluded.until_ms').bind(identifier,uid,until).run();return until;
}
