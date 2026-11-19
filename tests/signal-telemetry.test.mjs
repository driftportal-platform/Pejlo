import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackerTelemetry} from '../apps/api/gps.js';

test('network and satellite readings survive an invalid future GPS report without exposing private fields',()=>{
 const now=Date.now();
 const raw={serverTime:new Date(now).toISOString(),fixTime:new Date(now+8*3600000).toISOString(),valid:false,
  attributes:{sat:5,rssi:13,imei:'private'},network:{cellTowers:[{mobileCountryCode:238,mobileNetworkCode:2,locationAreaCode:14021,cellId:41969677,private:'secret'}],wifiAccessPoints:[{macAddress:'private'}]}};
 const result=trackerTelemetry(raw,now);
 assert.equal(result.satellites,5);assert.equal(result.rssi,13);assert.equal(result.receivedAt,now);
 assert.equal(result.gpsClockAhead,true);
 assert.deepEqual(result.cellTowers,[{mcc:238,mnc:2,lac:14021,cid:41969677}]);
 assert.equal(JSON.stringify(result).includes('private'),false);
});
test('missing signal is unknown, zero stays zero and malformed network reports are excluded',()=>{
 const absent=trackerTelemetry(null);assert.equal(absent.satellites,null);assert.equal(absent.rssi,null);assert.deepEqual(absent.cellTowers,[]);
 const zero=trackerTelemetry({attributes:{sat:0,rssi:0}});assert.equal(zero.satellites,0);assert.equal(zero.rssi,0);
 const bad=trackerTelemetry({attributes:{sat:'5',rssi:-1},network:{cellTowers:[null,{mobileCountryCode:'238'}, {mobileCountryCode:238,mobileNetworkCode:2,locationAreaCode:1,cellId:-1}]}});
 assert.equal(bad.satellites,null);assert.equal(bad.rssi,null);assert.deepEqual(bad.cellTowers,[]);
});
