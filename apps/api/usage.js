import {googleAccessToken} from './google-auth.js';
import {firebaseConfig} from '../web/src/config/firebase.js';

const cloudflareQuery = `query Usage($account: string!, $day: Date!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: {accountTag: $account}) {
      workersInvocationsAdaptive(limit: 1, filter: {datetime_geq: $start, datetime_leq: $end}) {
        sum { requests }
      }
      d1AnalyticsAdaptiveGroups(limit: 1, filter: {date_geq: $day, date_leq: $day}) {
        sum { rowsRead rowsWritten }
      }
    }
  }
}`;

const pacificDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
});
const pacificOffset = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset'
});

function firestoreDay(now) {
  const day = pacificDate.format(now);
  const utcMidnight = Date.parse(day + 'T00:00:00Z');
  // At this instant it is still the previous afternoon in California.
  const offset = pacificOffset.formatToParts(utcMidnight).find(part => part.type === 'timeZoneName').value;
  const start = utcMidnight - Number(offset.slice(3)) * 3600000;
  return {day, start: new Date(start).toISOString()};
}

async function providerJSON(fetcher, url, init) {
  const response = await fetcher(url, {
    ...init, redirect: 'manual', signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Målingen kunne ikke hentes.');
  return response.json();
}

function metricTotal(groups, field) {
  if (!Array.isArray(groups)) throw new Error('Målingen mangler.');
  return groups.reduce((total, group) => {
    const value = group.sum?.[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('Målingen er ugyldig.');
    }
    return total + value;
  }, 0);
}

async function cloudflareUsage(env, fetcher, now) {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) return {status: 'unconfigured'};
  const end = now.toISOString();
  const day = end.slice(0, 10);
  const result = await providerJSON(fetcher, 'https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + env.CF_ANALYTICS_TOKEN, 'Content-Type': 'application/json'},
    body: JSON.stringify({query: cloudflareQuery, variables: {account: env.CF_ACCOUNT_ID, day, start: day + 'T00:00:00Z', end}})
  });
  const account = result.data?.viewer?.accounts?.[0];
  if (!account || result.errors?.length) throw new Error('Cloudflare Analytics er utilgængelig.');
  return {
    status: 'ok', day,
    workers: metricTotal(account.workersInvocationsAdaptive, 'requests'),
    rowsRead: metricTotal(account.d1AnalyticsAdaptiveGroups, 'rowsRead'),
    rowsWritten: metricTotal(account.d1AnalyticsAdaptiveGroups, 'rowsWritten')
  };
}

async function firestoreTotal(fetcher, token, operation, start, end) {
  const url = new URL('https://monitoring.googleapis.com/v3/projects/' + firebaseConfig.projectId + '/timeSeries');
  url.search = new URLSearchParams({
    filter: `metric.type = "firestore.googleapis.com/document/${operation}_ops_count" AND resource.type = "firestore.googleapis.com/Database" AND resource.labels.database_id = "(default)"`,
    'interval.startTime': start,
    'interval.endTime': end,
    view: 'FULL'
  });
  let count = 0;
  do {
    const result = await providerJSON(fetcher, url, {headers: {Authorization: 'Bearer ' + token}});
    if (result.executionErrors?.length || result.unreachable?.length) throw new Error('Målingen er ufuldstændig.');
    for (const series of result.timeSeries ?? []) {
      for (const point of series.points ?? []) {
        // Monitoring includes intervals that overlap midnight. Exclude the previous day's part.
        if (Date.parse(point.interval?.startTime) < Date.parse(start)) continue;
        const value = Number(point.value?.int64Value);
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Målingen er ugyldig.');
        count += value;
      }
    }
    if (!result.nextPageToken) return count;
    url.searchParams.set('pageToken', result.nextPageToken);
  } while (true);
}

async function firestoreUsage(env, fetcher, now) {
  if (!env.GCP_MONITORING_SERVICE_ACCOUNT) return {status: 'unconfigured'};
  const {day, start} = firestoreDay(now);
  const token = await googleAccessToken(env.GCP_MONITORING_SERVICE_ACCOUNT, fetcher, 'https://www.googleapis.com/auth/monitoring.read', now);
  const [reads, writes] = await Promise.all(['read', 'write'].map(operation =>
    firestoreTotal(fetcher, token, operation, start, now.toISOString())));
  return {status: 'ok', day, reads, writes};
}

export async function adminUsage(env, fetcher, now = new Date()) {
  const [cloudflare, firestore] = await Promise.allSettled([
    cloudflareUsage(env, fetcher, now), firestoreUsage(env, fetcher, now)
  ]);
  const result = entry => entry.status === 'fulfilled' ? entry.value : {status: 'unavailable'};
  return {checkedAt: now.toISOString(), cloudflare: result(cloudflare), firestore: result(firestore)};
}
