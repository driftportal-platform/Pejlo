import {once} from './schema.js';

function fail(status, message) {
  throw Object.assign(new Error(message), {status});
}

export function configuredTrackerActions(env, identifier) {
  try {
    const config = JSON.parse(env.PEJLO_TRACKER_ACTIONS || '{}');
    const entry = Object.hasOwn(config, identifier) ? config[identifier] : null;
    const actions = {};
    for (const action of ['find','sound']) {
      const data = entry?.[action];
      if (typeof data === 'string' && /^(?:[0-9a-fA-F]{2}){1,512}$/.test(data)) actions[action] = data;
    }
    return actions;
  } catch {
    return {};
  }
}

// Only explicit client errors establish that the command was rejected before dispatch.
export const commandWasRejected = status => [400,401,403,404,422].includes(status);

export async function sendTrackerAction({db, identifier, device, action, command, traccar, traccarFetch}) {
  if (!command) fail(409, 'Funktionen er endnu ikke afprøvet og aktiveret for denne tracker.');
  if (device.status !== 'online') fail(409, 'Trackeren er offline. Prøv igen, når den er online.');
  const types = await traccar('/api/commands/types?' + new URLSearchParams({deviceId:String(device.id),textChannel:'false'}));
  if (!Array.isArray(types) || !types.some(type => type.type === 'custom')) fail(409, 'Traccar tilbyder ikke kommandoen for denne tracker.');

  await once(db,'trackerActions',() => db.prepare(`CREATE TABLE IF NOT EXISTS pejlo_tracker_actions (
    identifier TEXT NOT NULL, action TEXT NOT NULL, requested_at INTEGER NOT NULL, PRIMARY KEY(identifier,action))`).run());
  const startedAt = Date.now(), duration = action === 'find' ? 600000 : 30000;
  const reserved = await db.prepare(`INSERT INTO pejlo_tracker_actions(identifier,action,requested_at) VALUES(?,?,?)
    ON CONFLICT(identifier,action) DO UPDATE SET requested_at=excluded.requested_at
    WHERE pejlo_tracker_actions.requested_at<=? RETURNING identifier`)
    .bind(identifier,action,startedAt,startedAt-duration).first();
  if (!reserved) fail(429, action==='find'?'Vent til den seneste 10-minutters søgning er færdig.':'Vent 30 sekunder mellem lydkommandoer.');
  const response = await traccarFetch('/api/commands/send',{method:'POST',body:JSON.stringify({
    deviceId:device.id, type:'custom', textChannel:false, attributes:{data:command,noQueue:true}
  })});
  if (response.status===202) fail(502, 'Traccar har sat kommandoen i kø. Handlingen er ikke bekræftet.');
  if (!response.ok) {
    if (commandWasRejected(response.status)) {
      await db.prepare('UPDATE pejlo_tracker_actions SET requested_at=0 WHERE identifier=? AND action=? AND requested_at=?')
        .bind(identifier,action,startedAt).run();
    }
    fail(502, 'Traccar kunne ikke bekræfte kommandoen.');
  }
  return {startedAt, until:startedAt+duration};
}
