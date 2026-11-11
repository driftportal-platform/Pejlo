import {googleAccessToken} from './google-auth.js';

// Everything Pejlo's own database holds about one account. Tables that do not exist yet hold nothing and are skipped.
const mailKey = email => String(email ?? '').trim().toLowerCase() || '\u0000none';
const cleanups = [
  ['DELETE FROM pejlo_push WHERE owner_uid=?', uid => [uid]],
  ['DELETE FROM pejlo_push_queue WHERE owner_uid=?', uid => [uid]],
  ['DELETE FROM pejlo_alerts WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_snooze WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_alarm_history WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_events WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_mail_limits WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_mail_log WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_handoffs WHERE actor_uid=? OR owner_uid=?', uid => [uid, uid]],
  ['DELETE FROM pejlo_gps_filter WHERE owner_uid=?', uid => [uid]],
  ['DELETE FROM pejlo_fences WHERE owner_uid=?', uid => [uid]],
  ['DELETE FROM pejlo_profiles WHERE owner_uid=?', uid => [uid]],
  ['DELETE FROM pejlo_members WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_invites WHERE owner_uid=? OR lower(email)=?', (uid, email) => [uid, mailKey(email)]],
  ['DELETE FROM pejlo_subscription_requests WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_subscriptions WHERE uid=?', uid => [uid]],
  ['DELETE FROM pejlo_billing WHERE uid=?', uid => [uid]]
];

export async function deleteUserData(db, uid, email = '') {
  let rows = 0;
  for (const [sql, args] of cleanups) {
    try {
      const result = await db.prepare(sql).bind(...args(uid, email)).run();
      rows += Number(result?.meta?.changes ?? result?.changes ?? 0);
    } catch (error) {
      if (!/no such table/i.test(String(error?.message))) {
        throw Object.assign(new Error('Kundens data kunne ikke ryddes. Login er ikke slettet. Prøv igen.'), {status: 502});
      }
    }
  }
  return {rows};
}

// Firebase login can only be removed after Firestore confirms deletion of the account's profile document.
export async function deleteFirestoreState(secret, fetcher, projectId, uid) {
  try {
    const token = await googleAccessToken(secret, fetcher, 'https://www.googleapis.com/auth/cloud-platform');
    const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) +
      '/databases/(default)/documents/users/' + encodeURIComponent(uid) + '/private/state';
    const response = await fetcher(url, {method: 'DELETE', headers: {Authorization: 'Bearer ' + token}, redirect: 'failed', signal: AbortSignal.timeout(8000)});
    return response.ok ? 'deleted' : 'failed';
  } catch {
    return 'failed';
  }
}
