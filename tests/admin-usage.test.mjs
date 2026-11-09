import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, verify} from 'node:crypto';
import {adminUsage} from '../apps/api/usage.js';
import {handleAPI} from '../apps/api/worker.js';
import {firebaseConfig} from '../apps/web/src/config/firebase.js';

test('usage is admin-only and missing setup remains distinct from zero', async () => {
  const request = new Request('https://pejlo.example/api/admin/usage', {
    headers: {Authorization: 'Bearer login-token'}
  });
  const env = {TRACCAR_ADMIN_UID: 'admin'};
  for (const [uid, expected] of [['member', 403], ['admin', 200]]) {
    const response = await handleAPI(request, env, async url => {
      assert.equal(new URL(url).hostname, 'identitytoolkit.googleapis.com');
      return Response.json({users: [{localId: uid, emailVerified: true}]});
    });
    assert.equal(response.status, expected);
    if (expected === 200) {
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const usage = await response.json();
      assert.equal(usage.cloudflare.status, 'unconfigured');
      assert.equal(usage.firestore.status, 'unconfigured');
    }
  }
});

test('Cloudflare counts are account-wide and an unavailable Firebase source stays separate', async () => {
  const usage = await adminUsage({
    CF_ACCOUNT_ID: 'test-account', CF_ANALYTICS_TOKEN: 'test-token',
    GCP_MONITORING_SERVICE_ACCOUNT: 'bad configuration'
  }, async (url, init) => {
    assert.equal(new URL(url).hostname, 'api.cloudflare.com');
    const {variables, query} = JSON.parse(init.body);
    assert.equal(variables.start, '2026-11-02T00:00:00Z');
    assert.doesNotMatch(query, /databaseId|scriptName/);
    return Response.json({data: {viewer: {accounts: [{
      workersInvocationsAdaptive: [{sum: {requests: 140}}],
      d1AnalyticsAdaptiveGroups: [{sum: {rowsRead: 0, rowsWritten: 23}}]
    }]}}});
  }, new Date('2026-11-02T05:00:00Z'));
  assert.deepEqual(usage.cloudflare, {
    status: 'ok', day: '2026-11-02', workers: 140, rowsRead: 0, rowsWritten: 23
  });
  assert.deepEqual(usage.firestore, {status: 'unavailable'});
});

test('Firestore signs read-only access and totals only the current Pacific day across pages', async () => {
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const email = 'metrics@example.invalid';
  const env = {GCP_MONITORING_SERVICE_ACCOUNT: JSON.stringify({
    client_email: email, project_id: firebaseConfig.projectId,
    private_key: privateKey.export({type: 'pkcs8', format: 'pem'})
  })};
  // Midnight is still PDT on the day the clocks move back.
  const now = new Date('2026-11-01T13:00:00Z');
  const usage = await adminUsage(env, async (url, init) => {
    const target = new URL(url);
    if (target.hostname === 'oauth2.googleapis.com') {
      const [header, claims, signature] = init.body.get('assertion').split('.');
      const payload = JSON.parse(Buffer.from(claims, 'base64url'));
      assert.equal(payload.iss, email);
      assert.equal(payload.scope, 'https://www.googleapis.com/auth/monitoring.read');
      assert.ok(verify('sha256', Buffer.from(header + '.' + claims), publicKey, Buffer.from(signature, 'base64url')));
      return Response.json({access_token: 'monitoring-token'});
    }
    assert.equal(target.hostname, 'monitoring.googleapis.com');
    assert.equal(init.headers.Authorization, 'Bearer monitoring-token');
    assert.equal(target.searchParams.get('interval.startTime'), '2026-11-01T07:00:00.000Z');
    const read = target.searchParams.get('filter').includes('/read_ops_count');
    const next = target.searchParams.has('pageToken');
    const point = (startTime, int64Value) => ({interval: {startTime}, value: {int64Value}});
    return Response.json({
      timeSeries: [{points: [
        point('2026-11-01T06:59:00Z', '100'),
        point('2026-11-01T07:00:00Z', read ? (next ? '3' : '7') : '1')
      ]}],
      ...read && !next ? {nextPageToken: 'page2'} : {}
    });
  }, now);
  assert.deepEqual(usage.firestore, {status: 'ok', day: '2026-11-01', reads: 10, writes: 1});
});
