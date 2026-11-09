import {firebaseConfig} from '../web/src/config/firebase.js';
import {googleAccessToken} from './google-auth.js';
import {once} from './schema.js';

const identityUrl = 'https://identitytoolkit.googleapis.com/v1/projects/' + firebaseConfig.projectId + '/accounts';
const stages = ['none', 'trial', 'active', 'paused'];
const danishDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Copenhagen'});

function fail(status, message) {
  throw Object.assign(new Error(message), {status});
}

function inputEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Skriv en gyldig e-mailadresse.');
  return email;
}

function inputText(value, max) {
  if (typeof value !== 'string' || value.trim().length > max) fail(400, 'Kontrollér de indtastede oplysninger.');
  return value.trim();
}

function subscriptionInput(input) {
  const plan = inputText(input.plan, 80);
  const stage = input.stage;
  const expiresOn = input.expiresOn;
  if (!stages.includes(stage) || (stage !== 'none' && !plan) || (stage === 'none' && (plan || expiresOn))) {
    fail(400, 'Vælg en status og et abonnementsnavn.');
  }
  if (expiresOn !== '') {
    const date = new Date(expiresOn + 'T00:00:00Z');
    if (typeof expiresOn !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(expiresOn) ||
        !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== expiresOn) {
      fail(400, 'Skriv en gyldig udløbsdato.');
    }
  }
  return {plan, stage, expiresOn};
}

function publicSubscription(subscription) {
  const stage = subscription?.stage ?? 'none';
  const expiresOn = subscription?.expires_on ?? '';
  const expired = (stage === 'active' || stage === 'trial') && expiresOn && expiresOn < danishDate.format(new Date());
  return {plan: subscription?.plan ?? '', stage, expiresOn, status: expired ? 'expired' : stage};
}

function publicUser(user, adminUid, subscription) {
  return {
    uid: user.localId, email: user.email ?? '', name: user.displayName ?? '',
    verified: user.emailVerified === true, disabled: user.disabled === true, isAdmin: user.localId === adminUid,
    subscription: publicSubscription(subscription)
  };
}

async function identityClient(secret, fetcher) {
  if (!secret) fail(503, 'Brugeradministration mangler opsætning i Cloudflare.');
  let token;
  try {
    token = await googleAccessToken(secret, fetcher, 'https://www.googleapis.com/auth/cloud-platform');
  } catch {
    fail(502, 'Brugeradministrationen kunne ikke få adgang til Firebase.');
  }
  return async (suffix, body) => {
    let response, data;
    try {
      response = await fetcher(identityUrl + suffix, {
        method: body ? 'POST' : 'GET',
        headers: {Authorization: 'Bearer ' + token, ...(body ? {'Content-Type': 'application/json'} : {})},
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error', signal: AbortSignal.timeout(8000)
      });
      data = await response.json();
    } catch {
      fail(502, 'Firebase kunne ikke kontaktes. Hent listen igen, før du gentager en ændring.');
    }
    if (response.ok) return data;
    const code = data.error?.message?.split(' ')[0];
    if (code === 'EMAIL_EXISTS') fail(409, 'Der findes allerede en konto med den e-mail.');
    if (code === 'USER_NOT_FOUND') fail(404, 'Brugeren findes ikke længere.');
    fail(502, 'Firebase kunne ikke gennemføre handlingen. Kontrollér tjenestekontoens adgang.');
  };
}

const ensureSubscriptions = db => once(db, 'adminSubscriptions', () => db.prepare(
  'CREATE TABLE IF NOT EXISTS pejlo_subscriptions(uid TEXT PRIMARY KEY, plan TEXT NOT NULL, stage TEXT NOT NULL, expires_on TEXT NOT NULL)'
).run());

async function withSubscriptions(db, users, adminUid) {
  if (!users.length) return [];
  await ensureSubscriptions(db);
  const placeholders = users.map(() => '?').join(',');
  const rows = await db.prepare('SELECT * FROM pejlo_subscriptions WHERE uid IN (' + placeholders + ')')
    .bind(...users.map(user => user.localId)).all();
  const byUid = new Map(rows.results.map(row => [row.uid, row]));
  return users.map(user => publicUser(user, adminUid, byUid.get(user.localId)));
}

export async function adminUsers(env, adminUid, query, input, fetcher) {
  if (input === null) {
    const params = new URLSearchParams({maxResults: '25'});
    const cursor = query.get('cursor');
    const email = query.get('email');
    if (cursor) {
      if (cursor.length > 4000 || email) fail(400, 'Ugyldig side i brugerlisten.');
      params.set('nextPageToken', cursor);
    }
    const identity = await identityClient(env.GCP_FIREBASE_AUTH_SERVICE_ACCOUNT, fetcher);
    const page = email
      ? await identity(':lookup', {email: [inputEmail(email)]})
      : await identity(':batchGet?' + params);
    return {
      users: await withSubscriptions(env.DB, page.users ?? [], adminUid),
      nextCursor: email ? null : page.nextPageToken ?? null
    };
  }
  if (input?.action === 'create') {
    const email = inputEmail(input.email);
    const displayName = inputText(input.name, 100);
    const random = crypto.getRandomValues(new Uint8Array(24));
    const password = 'Aa7!' + Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
    const identity = await identityClient(env.GCP_FIREBASE_AUTH_SERVICE_ACCOUNT, fetcher);
    const created = await identity('', {email, displayName, password, emailVerified: false});
    if (!created.localId) fail(502, 'Oprettelsen kunne ikke bekræftes. Søg efter e-mailen.');
    return {user: publicUser({...created, email, displayName}, adminUid)};
  }
  if (!['account', 'subscription'].includes(input?.action) ||
      typeof input.uid !== 'string' || !input.uid || input.uid.length > 128) fail(400, 'Vælg en gyldig bruger.');
  if (input.action === 'account') {
    const displayName = inputText(input.name, 100);
    if (typeof input.disabled !== 'boolean') fail(400, 'Vælg kontoens adgang.');
    if (input.uid === adminUid && input.disabled) fail(400, 'Systemadmin kan ikke spærre sin egen konto.');
    const identity = await identityClient(env.GCP_FIREBASE_AUTH_SERVICE_ACCOUNT, fetcher);
    await identity(':update', {localId: input.uid, displayName, disableUser: input.disabled});
    return {name: displayName, disabled: input.disabled};
  }
  const {plan, stage, expiresOn} = subscriptionInput(input);
  const identity = await identityClient(env.GCP_FIREBASE_AUTH_SERVICE_ACCOUNT, fetcher);
  const found = await identity(':lookup', {localId: [input.uid]});
  if (!found.users?.some(user => user.localId === input.uid)) fail(404, 'Brugeren findes ikke længere.');
  await ensureSubscriptions(env.DB);
  await env.DB.prepare(`INSERT INTO pejlo_subscriptions (uid, plan, stage, expires_on) VALUES (?,?,?,?)
    ON CONFLICT(uid) DO UPDATE SET plan=excluded.plan, stage=excluded.stage, expires_on=excluded.expires_on`)
    .bind(input.uid, plan, stage, expiresOn).run();
  return {subscription: publicSubscription({plan, stage, expires_on: expiresOn})};
}
