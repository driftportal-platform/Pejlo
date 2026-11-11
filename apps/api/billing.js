import {once} from './schema.js';
import {subscriptionRates} from '../../packages/shared/pricing.js';

const fields = {
  monthly: ['STRIPE_PRICE_MONTHLY_FIRST', 'STRIPE_PRICE_MONTHLY_EXTRA', 'month', 1],
  annual: ['STRIPE_PRICE_ANNUAL_FIRST', 'STRIPE_PRICE_ANNUAL_EXTRA', 'year', 1],
  biennial: ['STRIPE_PRICE_BIENNIAL_FIRST', 'STRIPE_PRICE_BIENNIAL_EXTRA', 'year', 2]
};
const validPrice = id => /^price_[A-Za-z0-9]+$/.test(id ?? '');
const priceIds = (env, cycle) => fields[cycle].slice(0, 2).map(key => env[key]);
const baseCycles = ['monthly','annual'];
const validCustomer = id => /^cus_[A-Za-z0-9]+$/.test(id ?? '');
const dateInDenmark = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Copenhagen'});
const nowSeconds = () => Math.floor(Date.now() / 1000);
const webhookTypes = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'checkout.session.completed']);

function fail(status, message) {
  throw Object.assign(new Error(message), {status});
}

export function billingReady(env) {
  const ids = baseCycles.flatMap(cycle => priceIds(env, cycle));
  return /^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY ?? '') &&
    /^whsec_/.test(env.STRIPE_WEBHOOK_SECRET ?? '') &&
    /^bpc_[A-Za-z0-9]+$/.test(env.STRIPE_PORTAL_CONFIGURATION ?? '') &&
    new Set(ids).size === 4 && ids.every(validPrice);
}

export function checkoutCycles(env) {
  if (!billingReady(env)) return [];
  const twoYearIds = priceIds(env, 'biennial');
  const allIds = [...baseCycles.flatMap(cycle => priceIds(env, cycle)), ...twoYearIds];
  // Validate the 24-month purchase in Stripe's test environment until early cancellation/refunds are supported.
  return env.STRIPE_SECRET_KEY.startsWith('sk_test_') && twoYearIds.every(validPrice) && new Set(allIds).size === 6
    ? [...baseCycles,'biennial'] : baseCycles;
}

export const ensureBilling = db => once(db, 'stripeBilling', async () => {
  await db.prepare(`CREATE TABLE IF NOT EXISTS pejlo_billing (
    uid TEXT PRIMARY KEY, customer_id TEXT UNIQUE, checkout_key TEXT, checkout_until INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 0, saved_revision INTEGER NOT NULL DEFAULT 0, snapshot TEXT
  )`).run();
});

export function billingSnapshot(row) {
  return row?.snapshot ? JSON.parse(row.snapshot) : null;
}

export function stripeOwnsSubscription(row) {
  const snapshot = billingSnapshot(row);
  return !!snapshot && !['canceled', 'incomplete_expired'].includes(snapshot.stripeStatus);
}

export function effectiveSubscription(manual, billingRow) {
  const stripe = billingSnapshot(billingRow);
  return stripeOwnsSubscription(billingRow) || !manual || manual.stage === 'none' ? stripe ?? manual : manual;
}

async function stripe(env, fetcher, path, params, key) {
  const response = await fetcher('https://api.stripe.com/v1/' + path, {
    method: params ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(9000),
    headers: {Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Stripe-Version': '2025-03-31.basil',
      ...(params ? {'Content-Type': 'application/x-www-form-urlencoded'} : {}),
      ...(key ? {'Idempotency-Key': key} : {})},
    body: params ? new URLSearchParams(params) : undefined
  });
  if (!response.ok) fail(response.status === 409 ? 409 : 502, 'Stripe kunne ikke gennemføre handlingen. Prøv igen om lidt.');
  return response.json();
}

function stripeURL(value, hostname) {
  let url;
  try {url = new URL(value);} catch {}
  if (url?.origin !== 'https://' + hostname || url.username || url.password) fail(502, 'Stripe returnerede et ugyldigt link.');
  return url.href;
}

function plan(env, cycle, quantity) {
  const [base, extra, interval, intervalCount] = fields[cycle];
  const rate = subscriptionRates[cycle];
  return {
    interval, intervalCount, items: [{id: env[base], amount: rate.first, quantity: 1},
      ...(quantity > 1 ? [{id: env[extra], amount: rate.extra, quantity: quantity - 1}] : [])]
  };
}

function goodPrice(price, item, interval, intervalCount) {
  return price.id === item.id && price.active && price.currency === 'dkk' &&
    price.unit_amount === item.amount && price.recurring?.interval === interval && price.recurring?.interval_count === intervalCount &&
    price.tax_behavior === 'inclusive';
}

async function ensureCustomer(env, fetcher, account) {
  const db = env.DB, uid = account.localId;
  const row = await db.prepare('SELECT customer_id FROM pejlo_billing WHERE uid=?').bind(uid).first();
  if (row?.customer_id) return row.customer_id;
  const customer = await stripe(env, fetcher, 'customers', {email: account.email ?? ''}, 'pejlo-customer-' + uid);
  if (!validCustomer(customer.id)) fail(502, 'Stripe-kunden kunne ikke bekræftes.');
  await db.prepare(`INSERT INTO pejlo_billing(uid,customer_id) VALUES(?,?)
    ON CONFLICT(uid) DO UPDATE SET customer_id=COALESCE(pejlo_billing.customer_id,excluded.customer_id)`)
    .bind(uid, customer.id).run();
  return (await db.prepare('SELECT customer_id FROM pejlo_billing WHERE uid=?').bind(uid).first()).customer_id;
}

export async function startBilling(env, fetcher, account, origin, input) {
  if (!billingReady(env)) fail(503, 'Onlinebetaling er endnu ikke sat op.');
  const db = env.DB, uid = account.localId;
  await ensureBilling(db);
  if (input?.action === 'portal') {
    const row = await db.prepare('SELECT * FROM pejlo_billing WHERE uid=?').bind(uid).first();
    if (!row?.customer_id || !row.snapshot) fail(409, 'Der er endnu ikke et Stripe-abonnement at administrere.');
    const portal = await stripe(env, fetcher, 'billing_portal/sessions', {
      customer: row.customer_id, configuration: env.STRIPE_PORTAL_CONFIGURATION, return_url: origin + '/?abonnement=portal'
    });
    return {url: stripeURL(portal.url, 'billing.stripe.com')};
  }
  if (input?.action !== 'checkout' || !Object.hasOwn(fields, input.cycle) ||
      !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    fail(400, 'Vælg måneds- eller årsbetaling og 1–10 trackere.');
  }
  if (!checkoutCycles(env).includes(input.cycle)) fail(409, 'Denne betalingsperiode kan endnu ikke købes online.');
  const offering = plan(env, input.cycle, input.quantity);
  await Promise.all(offering.items.map(async item => {
    const price = await stripe(env, fetcher, 'prices/' + item.id);
    if (!goodPrice(price, item, offering.interval, offering.intervalCount)) fail(503, 'Stripe-prisen matcher ikke Pejlos prisliste.');
  }));
  const customer = await ensureCustomer(env, fetcher, account);
  const dbRow = await db.prepare('SELECT * FROM pejlo_billing WHERE uid=?').bind(uid).first();
  if (stripeOwnsSubscription(dbRow)) fail(409, 'Du har allerede et Stripe-abonnement. Åbn abonnementsstyring.');
  const now = nowSeconds(), today = dateInDenmark.format(new Date());
  const reservation = await db.prepare(`UPDATE pejlo_billing SET checkout_key=?,checkout_until=? WHERE uid=?
    AND checkout_until<=? AND saved_revision=? AND NOT EXISTS (
      SELECT 1 FROM pejlo_subscriptions s WHERE s.uid=pejlo_billing.uid
      AND (s.stage='paused' OR (s.stage IN ('active','trial') AND (s.expires_on='' OR s.expires_on>=?))))
    RETURNING checkout_key,checkout_until`)
    .bind(crypto.randomUUID(), now + 3600, uid, now, dbRow.saved_revision, today).first();
  const active = reservation ?? await db.prepare('SELECT * FROM pejlo_billing WHERE uid=?').bind(uid).first();
  if (stripeOwnsSubscription(active) || !active.checkout_key || active.checkout_until < now + 1800) {
    fail(409, 'Du har en eksisterende aftale eller et åbent køb. Afslut det først, eller prøv igen senere.');
  }
  const existing = await stripe(env, fetcher, 'subscriptions?' + new URLSearchParams({customer,status:'all',limit:'100'}));
  if (existing.has_more || !Array.isArray(existing.data)) fail(502, 'Eksisterende Stripe-abonnementer kunne ikke kontrolleres.');
  if (existing.data.some(item => item.metadata?.pejlo === '1' && !['canceled','incomplete_expired'].includes(item.status))) {
    fail(409, 'Du har allerede et Stripe-abonnement. Vent på at det bliver synkroniseret.');
  }
  const params = {
    customer, mode: 'subscription', 'payment_method_types[0]': 'card', expires_at: String(active.checkout_until),
    success_url: origin + '/?abonnement=betalt', cancel_url: origin + '/?abonnement=tilbage',
    'subscription_data[metadata][pejlo]': '1'
  };
  offering.items.forEach((item, i) => {
    params['line_items[' + i + '][price]'] = item.id;
    params['line_items[' + i + '][quantity]'] = String(item.quantity);
  });
  const checkout = await stripe(env, fetcher, 'checkout/sessions', params, 'pejlo-checkout-' + active.checkout_key);
  return {url: stripeURL(checkout.url, 'checkout.stripe.com')};
}

async function signedEvent(request, secret) {
  const header = request.headers.get('Stripe-Signature') ?? '';
  const pairs = header.split(',').map(field => field.split('='));
  const timestamp = pairs.find(([kind]) => kind === 't')?.[1] ?? '';
  const signatures = pairs.filter(([kind, value]) => kind === 'v1' && /^[0-9a-f]{64}$/.test(value)).map(([, value]) => value);
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(nowSeconds() - Number(timestamp)) > 300 || !signatures.length) {
    fail(400, 'Ugyldig Stripe-signatur.');
  }
  if (Number(request.headers.get('Content-Length') || 0) > 1048576) fail(413, 'Stripe-hændelsen er for stor.');
  const raw = await request.text();
  if (raw.length > 1048576) fail(413, 'Stripe-hændelsen er for stor.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['verify']);
  const signed = encoder.encode(timestamp + '.' + raw);
  for (const value of signatures) {
    const bytes = Uint8Array.from(value.match(/../g), octet => parseInt(octet, 16));
    if (await crypto.subtle.verify('HMAC', key, bytes, signed)) {
      try {return JSON.parse(raw);} catch {fail(400, 'Ugyldig Stripe-hændelse.');}
    }
  }
  fail(400, 'Ugyldig Stripe-signatur.');
}

function subscriptionSnapshot(env, subscription) {
  const items = subscription.items?.data ?? [];
  const cycle = Object.keys(fields).find(c => validPrice(env[fields[c][0]]) && items.some(item => item.price.id === env[fields[c][0]]));
  if (!cycle) fail(502, 'Stripe-abonnementets pris kunne ikke genkendes.');
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const periods = items.map(item => item.current_period_end).filter(Number.isFinite);
  const end = subscription.ended_at || subscription.cancel_at || (periods.length ? Math.min(...periods) : null);
  const stage = {active:'active', trialing:'trial', canceled:'expired', incomplete_expired:'expired'}[subscription.status] ?? 'paused';
  return {
    plan: 'Pejlo · ' + quantity + (quantity === 1 ? ' tracker' : ' trackere'),
    stage, expires_on: end ? dateInDenmark.format(new Date(end * 1000 - 1)) : '',
    price_ore: items.reduce((sum, item) => sum + item.price.unit_amount * item.quantity, 0),
    billing_cycle: cycle, provider: 'stripe', stripeStatus: subscription.status,
    cancelAtEnd: !['canceled','incomplete_expired'].includes(subscription.status) &&
      !!(subscription.cancel_at_period_end || subscription.cancel_at)
  };
}

export async function billingWebhook(env, request, fetcher) {
  if (!billingReady(env) || !env.DB) fail(503, 'Stripe mangler opsætning.');
  const event = await signedEvent(request, env.STRIPE_WEBHOOK_SECRET);
  if (event?.livemode !== env.STRIPE_SECRET_KEY.startsWith('sk_live_')) fail(400, 'Stripe-tilstanden matcher ikke.');
  const customer = event.data?.object?.customer;
  if (!webhookTypes.has(event.type) || !validCustomer(customer)) return {received: true};
  const db = env.DB;
  await ensureBilling(db);
  const row = await db.prepare('UPDATE pejlo_billing SET revision=revision+1 WHERE customer_id=? RETURNING revision').bind(customer).first();
  if (!row) return {received: true};
  // Read current Stripe state so a retry or out-of-order event cannot rewind the subscription.
  const response = await stripe(env, fetcher, 'subscriptions?' + new URLSearchParams({customer,status:'all',limit:'100'}));
  if (response.has_more || !Array.isArray(response.data)) fail(502, 'Stripe-abonnementet kunne ikke læses.');
  const matches = response.data.filter(item => item.metadata?.pejlo === '1');
  const current = matches.filter(item => !['canceled','incomplete_expired'].includes(item.status));
  if (current.length > 1) fail(409, 'Kunden har mere end ét Stripe-abonnement.');
  const subscription = current[0] ?? matches.sort((a,b) => b.created-a.created)[0];
  if (subscription) {
    const snapshot = subscriptionSnapshot(env, subscription);
    await db.prepare(`UPDATE pejlo_billing SET snapshot=?,saved_revision=?,checkout_until=CASE WHEN ? THEN 0 ELSE checkout_until END
      WHERE customer_id=? AND saved_revision<?`)
      .bind(JSON.stringify(snapshot), row.revision, +!!current.length, customer, row.revision).run();
  }
  return {received:true};
}
