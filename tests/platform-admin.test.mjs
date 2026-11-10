import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {handleAPI} from '../apps/api/worker.js';
import {firebaseConfig} from '../apps/web/src/config/firebase.js';

const admin = 'admin-uid';
const member = 'member-uid';
const email = 'customer@example.com';
const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const secret = JSON.stringify({
  project_id: firebaseConfig.projectId, client_email: 'service@example.com',
  private_key: privateKey.export({type: 'pkcs8', format: 'pem'})
});

function setup(caller = admin) {
  const calls = [];
  const users = new Map([[member, {localId: member, email, emailVerified: true, passwordHash: 'not-for-clients'}]]);
  const database = new DatabaseSync(':memory:');
  database.exec('CREATE TABLE trackers(identifier TEXT PRIMARY KEY, owner_uid TEXT)');
  database.exec("CREATE TABLE pejlo_subscriptions(uid TEXT PRIMARY KEY, plan TEXT NOT NULL, stage TEXT NOT NULL, expires_on TEXT NOT NULL)");
  const DB = {prepare(sql) {
    const statement=database.prepare(sql);
    let args=[];
    return {
      bind(...values) { args=values;return this; },
      async all() { return {results:statement.all(...args)}; },
      async first() { return statement.get(...args); },
      async run() { return statement.run(...args); }
    };
  }};
  const fetcher = async (url, options) => {
    const target = new URL(url);
    calls.push(target.pathname);
    if (target.pathname === '/v1/accounts:lookup') {
      return Response.json({users: [{localId: caller, emailVerified: true}]});
    }
    assert.equal(options.redirect, 'manual');
    if (target.hostname === 'oauth2.googleapis.com') return Response.json({access_token: 'service-token'});
    assert.equal(options.headers.Authorization, 'Bearer service-token');
    assert.ok(target.pathname.startsWith('/v1/projects/'+firebaseConfig.projectId+'/accounts'));
    if (target.pathname.endsWith(':batchGet')) {
      assert.equal(target.searchParams.get('maxResults'), '25');
      return Response.json({users: [...users.values()], nextPageToken: 'next-page'});
    }
    const body = JSON.parse(options.body);
    if (target.pathname.endsWith(':lookup')) {
      return Response.json({users: [...users.values()].filter(user =>
        body.email?.includes(user.email) || body.localId?.includes(user.localId))});
    }
    if (target.pathname.endsWith(':delete')) {
      assert.ok(users.delete(body.localId));
      return Response.json({});
    }
    if (target.pathname.endsWith(':update')) {
      Object.assign(users.get(body.localId),{displayName: body.displayName, disabled: body.disableUser});
      return Response.json({localId: body.localId});
    }
    if ([...users.values()].some(user => user.email === body.email)) {
      return Response.json({error: {message: 'EMAIL_EXISTS'}},{status: 400});
    }
    assert.match(body.password, /^Aa7![0-9a-f]{48}$/);
    assert.equal(body.emailVerified,false);
    users.set('new-id',{localId:'new-id',email:body.email});
    return Response.json({localId:'new-id',idToken:'not-for-clients'});
  };
  async function request(query = '', input) {
    const response = await handleAPI(new Request('https://pejlo.example/api/admin/users'+query,{
      method: input===undefined?'GET':'POST',headers:{Authorization:'Bearer user-token'},
      body: input===undefined?undefined:JSON.stringify(input)
    }),{DB,TRACCAR_ADMIN_UID:admin,GCP_FIREBASE_AUTH_SERVICE_ACCOUNT:secret},fetcher);
    return {status:response.status,body:await response.json()};
  }
  return {request,calls,database};
}

test('ordinary users cannot list or change accounts through the admin API',async()=>{
  const {request,calls}=setup(member);
  assert.equal((await request()).status,403);
  assert.equal((await request('',{action:'create',email,name:'Test'})).status,403);
  assert.deepEqual(calls,['/v1/accounts:lookup','/v1/accounts:lookup']);
});

test('system admin sees existing users and can manage subscriptions independently of login',async()=>{
  const {request}=setup();
  const first=await request();
  assert.equal(first.body.nextCursor,'next-page');
  assert.equal(first.body.users[0].subscription.status,'none');
  assert.doesNotMatch(JSON.stringify(first.body),/passwordHash|not-for-clients/);
  const input={action:'subscription',uid:member,plan:'Basis',stage:'active',expiresOn:'2020-01-01'};
  const expired=await request('',{...input,price:'49,95',billingCycle:'monthly'});
  assert.equal(expired.body.subscription.status,'expired');
  assert.equal(expired.body.subscription.priceOre,4995);
  assert.ok(expired.body.subscription.daysToExpiry<0);
  assert.equal((await request('',input)).body.subscription.priceOre,4995);
  assert.equal((await request('',{...input,price:'4,999',billingCycle:'monthly'})).status,400);
  assert.equal((await request('',{action:'subscription',uid:member,plan:'Basis',stage:'active',expiresOn:'2026-02-30'})).status,400);
  assert.equal((await request('',{action:'account',uid:admin,name:'Admin',disabled:true})).status,400);
  const lookup=await request('?email='+encodeURIComponent(email));
  assert.equal(lookup.body.users[0].subscription.plan,'Basis');
  assert.equal(lookup.body.users[0].subscription.billingCycle,'monthly');
  const free=await request('',{...input,price:'0',billingCycle:'annual',expiresOn:''});
  assert.equal(free.body.subscription.priceOre,0);
  assert.equal(free.body.subscription.daysToExpiry,null);
  assert.equal(lookup.body.users[0].disabled,false);
  assert.equal((await request('',{action:'account',uid:member,name:'Kunde',disabled:true})).status,200);
  assert.equal((await request()).body.users[0].disabled,true);
});

test('new users start unverified and duplicate creation is safe',async()=>{
  const {request}=setup();
  const input={action:'create',email:'new@example.com',name:'Ny kunde'};
  const created=await request('',input);
  assert.equal(created.status,200);
  assert.equal(created.body.user.verified,false);
  assert.equal(created.body.user.isAdmin,false);
  assert.doesNotMatch(JSON.stringify(created.body),/idToken|not-for-clients|password/);
  assert.equal((await request('',input)).status,409);
});

test('system admin has a separate page and its access check is enforced server-side',async()=>{
  const {readFileSync}=await import('node:fs');
  const appHtml=readFileSync('dist/index.html','utf8');
  const adminHtml=readFileSync('dist/admin/index.html','utf8');
  assert.match(appHtml, /id="system-admin-link"[^>]+href="\/admin\/" hidden/);
  for(const id of ['platform-users','platform-price','platform-cycle','platform-delete','admin-status','admin-usage','pairing-qr']){
    assert.ok(adminHtml.includes('id="'+id+'"'),id);
    assert.ok(!appHtml.includes('id="'+id+'"'),id);
  }
  assert.match(adminHtml, /id="auth-form"/);
  assert.match(adminHtml, /class="app admin-page" hidden/);
  assert.match(adminHtml, /src="\/src\/admin-page.js"/);
  assert.doesNotMatch(adminHtml, /id="kort"|src="[^"]*\/app\.js"/);

  const request=new Request('https://pejlo.example/api/admin/access',{
    headers:{Authorization:'Bearer token'}
  });
  for(const [uid,status] of [[member,403],[admin,200]]){
    const response=await handleAPI(request,{TRACCAR_ADMIN_UID:admin},async url=>{
      assert.equal(new URL(url).pathname,'/v1/accounts:lookup');
      return Response.json({users:[{localId:uid,emailVerified:true}]});
    });
    assert.equal(response.status,status);
    assert.equal(response.headers.get('cache-control'),'no-store');
  }
});


test('systemadmin can delete only a paused account after confirming its email and checking tracker links',async()=>{
  const {request,calls,database}=setup();
  const remove={action:'delete',uid:member,confirmEmail:email};
  assert.equal((await setup(member).request('',remove)).status,403);
  assert.equal((await request('',{...remove,uid:admin})).status,400);
  assert.equal((await request('',remove)).status,409);
  assert.equal((await request('',{action:'account',uid:member,name:'Kunde',disabled:true})).status,200);
  assert.equal((await request('',{...remove,confirmEmail:'other@example.com'})).status,400);
  database.prepare('INSERT INTO trackers VALUES (?,?)').run('tracker',member);
  assert.equal((await request('',remove)).status,409);
  database.exec('DELETE FROM trackers');
  database.prepare('INSERT INTO pejlo_members(identifier,uid,email) VALUES (?,?,?)').run('shared',member,email);
  assert.equal((await request('',remove)).status,409);
  database.exec('DELETE FROM pejlo_members');
  assert.ok(!calls.some(path=>path.endsWith(':delete')));
  assert.deepEqual(await request('',remove),{status:200,body:{deleted:true}});
  assert.equal((await request('?email='+encodeURIComponent(email))).body.users.length,0);
});

test('standard Pejlo prices separate the first and additional trackers',async()=>{
 const {standardSubscriptionPrice}=await import('../dist/src/features/platform-admin.js');
 assert.equal(standardSubscriptionPrice('monthly',1),4900);
 assert.equal(standardSubscriptionPrice('annual',1),44900);
 assert.equal(standardSubscriptionPrice('monthly',2),7800);
 assert.equal(standardSubscriptionPrice('annual',2),71800);
 assert.equal(standardSubscriptionPrice('annual',1.5),null);
 assert.equal(standardSubscriptionPrice('annual',0),null);
});
