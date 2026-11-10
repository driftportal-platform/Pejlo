import {once} from './schema.js';

const duration = 3600000;
const retention = 90 * 86400000;
export const ensureHandoffs = db => once(db, 'handoffs', async () => {
  await db.prepare(`CREATE TABLE IF NOT EXISTS pejlo_handoffs (
    id INTEGER PRIMARY KEY, identifier TEXT NOT NULL, owner_uid TEXT NOT NULL,
    actor_uid TEXT NOT NULL, actor_name TEXT NOT NULL, started_at INTEGER NOT NULL,
    until_ms INTEGER NOT NULL, ended_at INTEGER, position TEXT
  )`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS pejlo_handoffs_tracker ON pejlo_handoffs(identifier,owner_uid,id)').run();
});

const scope = 'identifier=? AND owner_uid=(SELECT owner_uid FROM trackers WHERE identifier=?)';
const active = 'ended_at IS NULL AND until_ms>?';
const publicHandoff = row => ({
  name: row.actor_name, startedAt: row.started_at, until: row.until_ms, endedAt: row.ended_at,
  position: row.position ? JSON.parse(row.position) : null
});

export async function currentHandoff(db, identifier, now = Date.now()) {
  await ensureHandoffs(db);
  return db.prepare(`SELECT * FROM pejlo_handoffs WHERE ${scope} AND ${active} ORDER BY id DESC LIMIT 1`)
    .bind(identifier, identifier, now).first();
}

export async function handoffHistory(db, identifier, now = Date.now()) {
  await ensureHandoffs(db);
  const {results} = await db.prepare(`SELECT * FROM pejlo_handoffs WHERE ${scope} AND started_at>=? ORDER BY id DESC LIMIT 20`)
    .bind(identifier, identifier, now - retention).all();
  return results.map(publicHandoff);
}

export async function pruneHandoffs(db, now) {
  await ensureHandoffs(db);
  await db.prepare('DELETE FROM pejlo_handoffs WHERE started_at<?').bind(now - retention).run();
}

export async function handoffAPI(db, identifier, account, access, input, now = Date.now()) {
  await ensureHandoffs(db);
  if (input?.action === 'start') {
    const name = (account.displayName?.trim() || account.email || 'Et familiemedlem').slice(0, 120);
    await db.prepare(`INSERT INTO pejlo_handoffs(identifier,owner_uid,actor_uid,actor_name,started_at,until_ms,position)
      SELECT t.identifier,t.owner_uid,?,?,?,?,? FROM trackers t WHERE t.identifier=?
      AND (t.owner_uid=? OR EXISTS(SELECT 1 FROM pejlo_members m JOIN pejlo_profiles p
        ON p.identifier=m.identifier AND p.owner_uid=t.owner_uid
        WHERE m.identifier=t.identifier AND m.uid=? AND m.role='editor'))
      AND NOT EXISTS(SELECT 1 FROM pejlo_handoffs WHERE identifier=t.identifier AND owner_uid=t.owner_uid AND ${active})`)
      .bind(account.localId, name, now, now + duration, input.position ? JSON.stringify(input.position) : null,
        identifier, account.localId, account.localId, now).run();
  }
  if (input?.action === 'stop') {
    await db.prepare(`UPDATE pejlo_handoffs SET ended_at=? WHERE ${scope} AND ${active}
      AND (actor_uid=? OR owner_uid=?) AND id=?`)
      .bind(now, identifier, identifier, now, account.localId, account.localId, input.id).run();
  }
  const row = await currentHandoff(db, identifier, now);
  return {
    handoff: row ? {...publicHandoff(row), id: row.id, canStop: access.owner || row.actor_uid === account.localId} : null,
    canStart: access.owner || access.role === 'editor', serverTime: now
  };
}
