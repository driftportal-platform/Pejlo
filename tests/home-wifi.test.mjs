import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanAccessPoints,cleanWifiConfig,homeWifiStatus,addWifiSample} from '../packages/shared/home-wifi.js';
import {trackerTelemetry} from '../apps/api/gps.js';
import {cleanProfile,defaultHome} from '../packages/shared/profiles.js';
const now=1800000000000,mac='28:BD:89:05:5C:10',other='28:BD:89:05:5C:47';
const data=(rssi=-45,at=now)=>({device:{status:'online'},telemetry:{wifiMeasuredAt:at,wifiAccessPoints:[{mac,rssi}]}});
const config={macs:[mac],samples:['inside','outside'].flatMap((label,j)=>[0,1,2].map(i=>({label,at:now-600000+(i+j*3)*30000,points:[{mac,rssi:j?-80:-45}]})))};
test('Traccar signed Wi-Fi readings survive without exposing unrelated fields',()=>{
 const t=trackerTelemetry({serverTime:new Date(now).toISOString(),deviceTime:new Date(now-5000).toISOString(),network:{wifiAccessPoints:[{macAddress:mac.toLowerCase(),signalStrength:-49,password:'secret'},{macAddress:other,signalStrength:-67}]}},now);
 assert.deepEqual(t.wifiAccessPoints,[{mac,rssi:-49},{mac:other,rssi:-67}]);assert.equal(t.wifiMeasuredAt,now-5000);assert.ok(!JSON.stringify(t).includes('secret'));
});
test('reject invalid RSSI and addresses and deduplicate strongest reading',()=>{
 assert.deepEqual(cleanAccessPoints([{mac,rssi:-67},{mac:mac.toLowerCase(),rssi:-49},{mac,rssi:0},{mac,rssi:'-40'},{mac:'FF:FF:FF:FF:FF:FF',rssi:-50},null]),[{mac,rssi:-49}]);assert.deepEqual(cleanAccessPoints({}),[]);
});
test('buffered reading age is not replaced by arrival time',()=>{
 const t=trackerTelemetry({serverTime:new Date(now).toISOString(),deviceTime:new Date(now-600000).toISOString(),network:{wifiAccessPoints:[{macAddress:mac,signalStrength:-45}]}},now);
 assert.equal(homeWifiStatus({device:{status:'online'},telemetry:t},config,now).kind,'unknown');
});
test('learned patterns classify clear cases but no probability or ambiguous claims',()=>{
 assert.equal(homeWifiStatus(data(),config,now).kind,'inside');assert.equal(homeWifiStatus(data(-80),config,now).kind,'outside');assert.equal(homeWifiStatus(data(-62),config,now).kind,'unknown');assert.equal(homeWifiStatus(data(),config,now).probability,undefined);
});
test('unseen, missing and untrained Wi-Fi patterns never imply outside',()=>{
 assert.equal(homeWifiStatus(data(-99),config,now).kind,'unknown');
 assert.equal(homeWifiStatus({device:{status:'online'},telemetry:{wifiMeasuredAt:now,wifiAccessPoints:[{mac:other,rssi:-40}]}},config,now).kind,'unknown');assert.equal(homeWifiStatus(data(),{macs:[mac],samples:[]},now).kind,'unknown');
});
test('old, future, offline and undated readings stay uncertain',()=>{
 for(const v of [data(-45,now-120001),data(-45,now+60000),data(-45,null),{...data(),device:{status:'offline'}},{...data(),device:{status:'unknown'}}])assert.equal(homeWifiStatus(v,config,now).kind,'unknown');
});
test('training requires separate fresh observations of configured home points',()=>{
 const c=addWifiSample({macs:[mac]},data(),'inside',now);assert.equal(c.samples.length,1);assert.throws(()=>addWifiSample(c,data(),'outside',now),/20 sekunder/);assert.throws(()=>addWifiSample(c,data(-45,now-600000),'inside',now),/frisk/);assert.throws(()=>addWifiSample({macs:[]},data(),'inside',now),/frisk/);assert.throws(()=>addWifiSample(c,data(),'invalid',now),/inde eller ude/);
});
test('cloud profile cleaning retains training within the selected profile',()=>{
 const p=cleanProfile({id:'cat',name:'Loui',type:'cat',home:defaultHome,homeWifi:config});assert.deepEqual(p.homeWifi,config);
 const q=cleanProfile({id:'other',name:'Other',type:'cat',home:defaultHome});assert.equal(homeWifiStatus(data(),q.homeWifi,now).kind,'unknown');assert.deepEqual(cleanWifiConfig({macs:[mac],samples:[{label:'inside',at:now,points:[{mac:other,rssi:-20}]}]}).samples,[]);
});
