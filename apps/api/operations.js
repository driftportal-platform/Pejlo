import {once} from './schema.js';
import {ensureFamily} from './family.js';
import {ensureArchive} from './archive.js';
export const ensureOperations=db=>once(db,'operations',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_runs(id TEXT PRIMARY KEY,started_at INTEGER NOT NULL,finished_at INTEGER,status TEXT NOT NULL,checked INTEGER NOT NULL DEFAULT 0,errors INTEGER NOT NULL DEFAULT 0,upstream_requests INTEGER NOT NULL DEFAULT 0,upstream_errors INTEGER NOT NULL DEFAULT 0)').run());
export async function adminStatus(env){
 const db=env.DB;await ensureOperations(db);await ensureFamily(db);await ensureArchive(db);
 const count=async sql=>(await db.prepare(sql).first()).n;
 const runs=(await db.prepare('SELECT * FROM pejlo_runs ORDER BY started_at DESC LIMIT 20').all()).results;
 const counts={trackers:await count('SELECT COUNT(*) AS n FROM trackers'),claimed:await count('SELECT COUNT(*) AS n FROM trackers WHERE owner_uid IS NOT NULL'),profiles:await count('SELECT COUNT(*) AS n FROM pejlo_profiles'),fences:await count('SELECT COUNT(*) AS n FROM pejlo_fences WHERE enabled=1'),pushDevices:await count('SELECT COUNT(*) AS n FROM pejlo_push'),queued:await count('SELECT COUNT(*) AS n FROM pejlo_events')};
 // Never expose push endpoints, keys, payloads or raw upstream error messages.
 const users=(await db.prepare('SELECT owner_uid AS uid,COUNT(*) AS devices FROM pejlo_push GROUP BY owner_uid ORDER BY owner_uid LIMIT 100').all()).results;
 return {checkedAt:Date.now(),runs,counts,pushUsers:users,pushUsersTruncated:(await count('SELECT COUNT(DISTINCT owner_uid) AS n FROM pejlo_push'))>100,configured:{traccar:!!env.TRACCAR_TOKEN,push:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT),mail:!!(env.RESEND_API_KEY&&env.MAIL_FROM)}};
}
