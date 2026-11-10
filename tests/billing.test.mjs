import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {handleAPI} from '../apps/api/worker.js';

function setup() {
 const sqlite = new DatabaseSync(':memory:');
 const DB = {prepare(sql) {
  const stmt = sqlite.prepare(sql);let args=[];
  return {bind(...values){args=values;return this;},async run(){return stmt.run(...args);},
   async first(){return stmt.get(...args);},async all(){return {results:stmt.all(...args)};}};
 }};
 const env={DB,STRIPE_SECRET_KEY:'sk_test_mock',STRIPE_WEBHOOK_SECRET:'whsec_mock',
  STRIPE_PORTAL_CONFIGURATION:'bpc_test',STRIPE_PRICE_MONTHLY_FIRST:'price_mfirst',
  STRIPE_PRICE_MONTHLY_EXTRA:'price_mextra',STRIPE_PRICE_ANNUAL_FIRST:'price_afirst',STRIPE_PRICE_ANNUAL_EXTRA:'price_aextra'};
 const recorded=[],sessions=new Map();
 let remote=[];
 const fetcher=async (url,options)=>{
  const path=new URL(url).pathname;
  if(path==='/v1/accounts:lookup')return Response.json({users:[{localId:'customer',emailVerified:true,email:'test@example.com'}]});
  assert.equal(options.redirect,'manual');
  if(path.startsWith('/v1/prices/')){
   const id=path.split('/').at(-1);
   return Response.json({id,currency:'dkk',active:true,unit_amount:id==='price_afirst'?44900:26900,
    recurring:{interval:'year',interval_count:1},tax_behavior:'inclusive'});
  }
  if(path==='/v1/customers')return Response.json({id:'cus_demo'});
  if(path==='/v1/subscriptions')return Response.json({data:remote,has_more:false});
  if(path==='/v1/checkout/sessions'){
   const key=options.headers['Idempotency-Key'], data=Object.fromEntries(options.body);
   recorded.push({key,data});
   if(sessions.has(key))assert.deepEqual(sessions.get(key),data);
   sessions.set(key,data);
   return Response.json({url:'https://checkout.stripe.com/c/pay/test'});
  }
  if(path==='/v1/billing_portal/sessions'){
   assert.equal(options.body.get('customer'),'cus_demo');
   return Response.json({url:'https://billing.stripe.com/p/session/test'});
  }
  throw Error('Unexpected Stripe request '+path);
 };
 async function api(path,input){
  return handleAPI(new Request('https://pejlo.example/api/'+path,{method:input?'POST':'GET',
   headers:{Authorization:'Bearer user-token'},body:input?JSON.stringify(input):undefined}),env,fetcher);
 }
 function webhook(type, secret=env.STRIPE_WEBHOOK_SECRET, age=0){
  const raw=JSON.stringify({livemode:false,type,data:{object:{customer:'cus_demo'}}});
  const t=Math.floor(Date.now()/1000)-age;
  const sig=createHmac('sha256',secret).update(t+'.'+raw).digest('hex');
  return handleAPI(new Request('https://pejlo.example/api/stripe/webhook',{method:'POST',body:raw,
   headers:{'Stripe-Signature':'t='+t+',v1='+sig}}),env,fetcher);
 }
 return {api,webhook,recorded,sessions,setRemote:value=>remote=value};
}

test('Stripe Checkout reserves one session and signed events reconcile current subscription status',async()=>{
 const {api,webhook,recorded,sessions,setRemote}=setup();
 assert.equal((await (await api('subscription')).json()).checkout,true);
 const input={action:'checkout',cycle:'annual',quantity:2,price:1};
 const results=await Promise.all([api('billing',input),api('billing',input)]);
 for(const result of results)assert.equal(result.status,200,await result.text());
 assert.equal(sessions.size,1);
 assert.equal(recorded[0].data['line_items[0][price]'],'price_afirst');
 assert.equal(recorded[0].data['line_items[1][price]'],'price_aextra');
 assert.equal(recorded[0].data['line_items[1][quantity]'],'1');
 assert.equal((await webhook('checkout.session.completed','whsec_wrong')).status,400);
 assert.equal((await webhook('checkout.session.completed',undefined,360)).status,400);
 assert.equal((await (await api('subscription')).json()).subscription.stage,'none');

 const active={metadata:{pejlo:'1'},status:'active',created:1,
  items:{data:[['price_afirst',44900],['price_aextra',26900]].map(([id,amount])=>({
   price:{id,unit_amount:amount},quantity:1,current_period_end:Date.parse('2027-11-10')/1000
  }))}};
 setRemote([active]);
 assert.equal((await webhook('invoice.paid')).status,200);
 let view=await (await api('subscription')).json();
 assert.equal(view.checkout,false);assert.equal(view.portal,true);assert.equal(view.subscription.priceOre,71800);
 assert.equal(view.subscription.expiresOn,'2027-11-10');
 assert.equal((await api('billing',input)).status,409);
 assert.equal((await api('billing',{action:'portal',customer:'cus_other'})).status,200);
 assert.equal((await api('subscription',{kind:'renew'})).status,409);
 setRemote([{...active,cancel_at_period_end:true}]);
 assert.equal((await webhook('customer.subscription.updated')).status,200);
 view=await (await api('subscription')).json();
 assert.equal(view.subscription.cancelAtEnd,true);
 setRemote([{...active,status:'canceled',ended_at:Date.parse('2026-11-10')/1000}]);
 assert.equal((await webhook('customer.subscription.deleted')).status,200);
 assert.equal((await webhook('invoice.paid')).status,200);
 view=await (await api('subscription')).json();
 assert.equal(view.subscription.status,'expired');
 assert.equal(view.checkout,true);
});
