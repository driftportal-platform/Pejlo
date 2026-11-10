import {ensureBilling,billingReady,billingSnapshot,effectiveSubscription,stripeOwnsSubscription} from './billing.js';
import {once} from './schema.js';

const danishDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Copenhagen'});
const dayMs = 86400000;
const todayInDenmark = () => danishDate.format(new Date());

export function publicSubscription(subscription) {
  const stage = subscription?.stage ?? 'none';
  const expiresOn = subscription?.expires_on ?? '';
  const today = todayInDenmark();
  const daysToExpiry = expiresOn ? (Date.parse(expiresOn) - Date.parse(today)) / dayMs : null;
  const expired = (stage === 'active' || stage === 'trial') && daysToExpiry !== null && daysToExpiry < 0;
  return {
    plan: subscription?.plan ?? '', stage, expiresOn, status: expired ? 'expired' : stage,
    daysToExpiry, provider: subscription?.provider ?? 'manual',
    managed: !!subscription?.stripeStatus && !['canceled','incomplete_expired'].includes(subscription.stripeStatus), cancelAtEnd: !!subscription?.cancelAtEnd, priceOre: subscription?.price_ore ?? null, billingCycle: subscription?.billing_cycle ?? ''
  };
}

export const ensureSubscriptions = db => once(db, 'adminSubscriptions', async () => {
  await db.prepare('CREATE TABLE IF NOT EXISTS pejlo_subscriptions(uid TEXT PRIMARY KEY, plan TEXT NOT NULL, stage TEXT NOT NULL, expires_on TEXT NOT NULL)').run();
  for (const definition of ['price_ore INTEGER', "billing_cycle TEXT NOT NULL DEFAULT ''"]) {
    try {
      await db.prepare('ALTER TABLE pejlo_subscriptions ADD COLUMN ' + definition).run();
    } catch (error) {
      if (!/duplicate column/i.test(String(error?.message))) throw error;
    }
  }
});

const ensureRequests = db => once(db, 'subscriptionRequests', () => db.prepare(
  'CREATE TABLE IF NOT EXISTS pejlo_subscription_requests(uid TEXT PRIMARY KEY,id TEXT NOT NULL,email TEXT NOT NULL,kind TEXT NOT NULL,created_at INTEGER NOT NULL,handled_at INTEGER)'
).run());

function fail(status, message) {
  throw Object.assign(new Error(message), {status});
}

async function customerView(db, uid, env) {
  const subscription = await db.prepare('SELECT * FROM pejlo_subscriptions WHERE uid=?').bind(uid).first();
  const request = await db.prepare('SELECT kind,created_at AS createdAt,handled_at AS handledAt FROM pejlo_subscription_requests WHERE uid=?')
    .bind(uid).first();
  const billing = await db.prepare('SELECT snapshot FROM pejlo_billing WHERE uid=?').bind(uid).first();
  const effective = publicSubscription(effectiveSubscription(subscription, billing));
  return {subscription: effective, request: request ?? null,
    checkout: billingReady(env) && !stripeOwnsSubscription(billing) && ['none','expired'].includes(effective.status),
    portal: billingReady(env) && !!billingSnapshot(billing)};
}

export async function customerSubscription(db, account, input, env = {}) {
  const uid = account.localId;
  if (input !== null && !['renew', 'cancel'].includes(input.kind)) fail(400, 'Vælg forlængelse eller opsigelse.');
  await ensureSubscriptions(db);
  await ensureRequests(db);
  await ensureBilling(db);
  if (input === null) return customerView(db, uid, env);
  if (stripeOwnsSubscription(await db.prepare('SELECT snapshot FROM pejlo_billing WHERE uid=?').bind(uid).first())) {
    fail(409, 'Administrér dit Stripe-abonnement via abonnementsstyring.');
  }

  const {kind} = input;
  // The eligibility check and the pending-request limit are part of one write.
  const saved = await db.prepare(`
    INSERT INTO pejlo_subscription_requests(uid,id,email,kind,created_at,handled_at)
    SELECT uid,?,?,?,?,NULL FROM pejlo_subscriptions
    WHERE uid=? AND stage IN ('active','trial','paused') AND (?='renew' OR expires_on='' OR expires_on>=?)
    ON CONFLICT(uid) DO UPDATE SET id=excluded.id,email=excluded.email,kind=excluded.kind,
      created_at=excluded.created_at,handled_at=NULL
    WHERE pejlo_subscription_requests.handled_at IS NOT NULL
    RETURNING id`)
    .bind(crypto.randomUUID(), account.email ?? '', kind, Date.now(), uid, kind, todayInDenmark()).first();

  const view = await customerView(db, uid, env);
  if (saved || (view.request?.kind === kind && view.request.handledAt === null)) return view;
  if (view.request?.handledAt === null) fail(409, 'Du har allerede en anmodning under behandling.');
  fail(409, 'Handlingen er ikke tilgængelig for dit abonnement.');
}

export async function adminSubscriptionRequests(db, input) {
  await ensureRequests(db);
  if (input === null) {
    const {results} = await db.prepare(`
      SELECT uid,id,email,kind,created_at AS createdAt FROM pejlo_subscription_requests
      WHERE handled_at IS NULL ORDER BY created_at,uid LIMIT 31`).all();
    return {requests: results.slice(0, 30), hasMore: results.length > 30};
  }
  if (typeof input.uid !== 'string' || !input.uid || input.uid.length > 128 ||
      typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/.test(input.id)) fail(400, 'Vælg en gyldig anmodning.');
  const handled = await db.prepare(`
    UPDATE pejlo_subscription_requests SET handled_at=COALESCE(handled_at,?) WHERE uid=? AND id=? RETURNING id`)
    .bind(Date.now(), input.uid, input.id).first();
  if (!handled) fail(409, 'Anmodningen er ændret. Hent listen igen.');
  return {handled: true};
}
