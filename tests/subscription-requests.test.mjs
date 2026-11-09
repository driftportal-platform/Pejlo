import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleAPI} from '../apps/api/worker.js';

test('customers see only their subscription and systemadmin handles pending requests',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec("CREATE TABLE pejlo_subscriptions(uid TEXT PRIMARY KEY,plan TEXT NOT NULL,stage TEXT NOT NULL,expires_on TEXT NOT NULL)");
 sqlite.exec("INSERT INTO pejlo_subscriptions VALUES ('first','Basis','active','2099-01-01'),('second','Plus','active',''),('expired','Basis','active','2020-01-01')");
 const DB={prepare(sql){
  const statement=sqlite.prepare(sql);
  let args=[];
  return {
   bind(...values){args=values;return this;},
   async first(){return statement.get(...args);},
   async all(){return {results:statement.all(...args)};},
   async run(){return statement.run(...args);}
  };
 }};
 async function call(uid,path,input){
  const res=await handleAPI(new Request('https://pejlo.example/api/'+path,{
   headers:{Authorization:'Bearer session'},
   method:input?'POST':'GET',body:input?JSON.stringify(input):undefined
  }),{DB,TRACCAR_ADMIN_UID:'admin'},async()=>Response.json({
   users:[{localId:uid,email:uid+'@example.com',emailVerified:true}]
  }));
  return {status:res.status,body:await res.json()};
 }
 const subscription='subscription';
 const queue='admin/subscription-requests';
 assert.equal((await call('first',subscription+'?uid=second')).body.subscription.plan,'Basis');
 assert.equal((await call('first',queue)).status,403);
 assert.equal((await call('none',subscription,{kind:'renew'})).status,409);
 assert.equal((await call('expired',subscription,{kind:'cancel'})).status,409);
 assert.equal((await call('first',subscription,{kind:'renew',uid:'second'})).body.request.kind,'renew');
 assert.equal((await call('first',subscription,{kind:'renew'})).status,200);
 assert.equal((await call('first',subscription,{kind:'cancel'})).status,409);
 assert.equal((await call('second',subscription)).body.request,null);
 const pending=(await call('admin',queue)).body.requests;
 assert.equal(pending.length,1);
 assert.equal(pending[0].email,'first@example.com');
 assert.equal((await call('second',queue,pending[0])).status,403);
 assert.equal((await call('admin',queue,pending[0])).status,200);
 assert.equal((await call('admin',queue)).body.requests.length,0);
 assert.ok((await call('first',subscription)).body.request.handledAt);
 assert.equal((await call('first',subscription,{kind:'cancel'})).body.subscription.status,'active');
 assert.equal((await call('admin',queue,pending[0])).status,409);
 assert.equal((await call('admin',queue)).body.requests[0].kind,'cancel');
});
