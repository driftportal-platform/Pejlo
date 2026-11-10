import {ensureBilling,effectiveSubscription,stripeOwnsSubscription} from './billing.js';
import {firebaseConfig} from '../web/src/config/firebase.js';
import {googleAccessToken} from './google-auth.js';
import {ensureSubscriptions,publicSubscription} from './subscriptions.js';
import {ensureFamily} from './family.js';

const identityUrl = 'https://identitytoolkit.googleapis.com/v1/projects/' + firebaseConfig.projectId + '/accounts';
const stages = ['none', 'trial', 'active', 'paused'];
const billingCycles = ['monthly', 'annual'];

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
  // Older clients omit both fields. Preserve an existing price in that case.
  const updatePricing = stage === 'none' || input.price !== undefined || input.billingCycle !== undefined;
  const price = input.price ?? '';
  const billingCycle = stage === 'none' ? '' : (input.billingCycle ?? '');
  if (typeof price !== 'string' || !/^(?:\d{1,7}(?:[,.]\d{1,2})?)?$/.test(price) ||
      (billingCycle !== '' && !billingCycles.includes(billingCycle)) || (price && (!billingCycle || stage === 'none'))) {
    fail(400, 'Skriv en pris i kroner med højst to decimaler, og vælg en prisperiode.');
  }
  const [kroner, decimal = ''] = price.split(/[,.]/);
  const priceOre = price === '' ? null : Number(kroner) * 100 + Number(decimal.padEnd(2, '0'));
  return {plan, stage, expiresOn, updatePricing, priceOre, billingCycle};
}

function publicUser(user, adminUid, subscription) {
  return {
    uid: user.localId, email: user.email ?? '', name: user.displayName ?? '',
    verified: user.emailVerified === true, disabled: user.disabled === true, isAdmin: user.localId === adminUid,
    subscription: publicSubscription(subscription)
  };
}

async function identityClient(secret, fetcher) {
  if (!secret) fail(503, 'Brugeradministrationen mangler Cloudflare Secret GCP_FIREBASE_AUTH_SERVICE_ACCOUNT.');
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
        redirect: 'manual', signal: AbortSignal.timeout(8000)
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

async function withSubscriptions(db, users, adminUid) {
  if (!users.length) return [];
  await ensureSubscriptions(db);
  const placeholders = users.map(() => '?').join(',');
  const rows = await db.prepare('SELECT * FROM pejlo_subscriptions WHERE uid IN (' + placeholders + ')')
    .bind(...users.map(user => user.localId)).all();
  const byUid = new Map(rows.results.map(row => [row.uid, row]));
  await ensureBilling(db);
  const billing = await db.prepare('SELECT uid,snapshot FROM pejlo_billing WHERE uid IN (' + placeholders + ')')
    .bind(...users.map(user => user.localId)).all();
  for (const row of billing.results) byUid.set(row.uid, effectiveSubscription(byUid.get(row.uid), row));
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
  if (!['account', 'subscription', 'delete'].includes(input?.action) ||
      typeof input.uid !== 'string' || !input.uid || input.uid.length > 128) fail(400, 'Vælg en gyldig bruger.');
  if (input.action === 'account') {
    const displayName = inputText(input.name, 100);
    if (typeof input.disabled !== 'boolean') fail(400, 'Vælg kontoens adgang.');
    if (input.uid === adminUid && input.disabled) fail(400, 'Systemadmin kan ikke spærre sin egen konto.');
    const identity = await identityClient(env.GCP_FIREBASE_AUTH_SERVICE_ACCOUNT, fetcher);
    await identity(':update', {localId: input.uid, displayName, disableUser: input.disabled});
    return {name: displayName, disabled: input.disabled};
  }
  if (input.action === 'delete') {
    if (input.uid === adminUid) fail(400, 'Systemadmin kan ikke slette sit eget login.');
    const confirmedEmail = inputEmail(input.confirmEmail);
    const identity = await identityClient(env.GCP_FIREBASE_AUTH_SERVICE_ACCOUNT, fetcher);
    const found = await identity(':lookup', {localId: [input.uid]});
    const user = found.users?.find(candidate => candidate.localId === input.uid);
    if (!user) fail(404, 'Brugeren findes ikke længere. Hent kundelisten igen.');
    if (user.email?.toLowerCase() !== confirmedEmail) fail(400, 'E-mailen matcher ikke den valgte kunde.');
    if (user.disabled !== true) fail(409, 'Sæt kundens login på pause før sletning.');

    await guardBilling(env.DB, input.uid);
    await ensureFamily(env.DB);
    const attached = await env.DB.prepare(`
      SELECT 1 FROM trackers WHERE owner_uid=?
      UNION ALL SELECT 1 FROM pejlo_members WHERE uid=?
      LIMIT 1`).bind(input.uid, input.uid).first();
    if (attached) fail(409, 'Kunden ejer eller har adgang til en tracker. Fjern trackeradgangen før sletning.');
    await identity(':delete', {localId: input.uid});
    return {deleted: true};
  }
  const {plan, stage, expiresOn, updatePricing, priceOre, billingCycle} = subscriptionInput(input);
  const identity = await identityClient(env.GCP_FIREBASE_AUTH_SERVICE_ACCOUNT, fetcher);
  const found = await identity(':lookup', {localId: [input.uid]});
  if (!found.users?.some(user => user.localId === input.uid)) fail(404, 'Brugeren findes ikke længere.');
  await ensureSubscriptions(env.DB);
  await ensureBilling(env.DB);
  const saved = await env.DB.prepare(`INSERT INTO pejlo_subscriptions (uid, plan, stage, expires_on, price_ore, billing_cycle)
    SELECT ?,?,?,?,?,? WHERE NOT EXISTS (
      SELECT 1 FROM pejlo_billing WHERE uid=? AND
      (checkout_until>? OR json_extract(snapshot,'$.stripeStatus') NOT IN ('canceled','incomplete_expired')))
    ON CONFLICT(uid) DO UPDATE SET plan=excluded.plan, stage=excluded.stage, expires_on=excluded.expires_on,
      price_ore=CASE WHEN ? THEN excluded.price_ore ELSE pejlo_subscriptions.price_ore END,
      billing_cycle=CASE WHEN ? THEN excluded.billing_cycle ELSE pejlo_subscriptions.billing_cycle END
    RETURNING plan, stage, expires_on, price_ore, billing_cycle`)
    .bind(input.uid, plan, stage, expiresOn, priceOre, billingCycle, input.uid, Math.floor(Date.now()/1000), +updatePricing, +updatePricing).first();
  if (!saved) fail(409, 'Kunden har et åbent køb eller et Stripe-abonnement.');
  return {subscription: publicSubscription(saved)};
}

async function guardBilling(db, uid) {
  await ensureBilling(db);
  const billing = await db.prepare('SELECT snapshot,checkout_until FROM pejlo_billing WHERE uid=?').bind(uid).first();
  if (stripeOwnsSubscription(billing) || billing?.checkout_until > Date.now()/1000) {
    fail(409, 'Kunden har et åbent køb eller et Stripe-abonnement. Administrér det i Stripe først.');
  }
}
