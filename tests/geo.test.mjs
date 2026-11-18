import {test} from 'node:test';import assert from 'node:assert/strict';import {distance,formatDistance} from '../packages/shared/geo.js';test('known distances and formatting',()=>{assert.equal(distance({lat:0,lon:0},{lat:0,lon:0}),0);assert.ok(Math.abs(distance({lat:0,lon:0},{lat:0,lon:1})-111195)<1);assert.equal(formatDistance(240),'240 m');assert.equal(formatDistance(1250),'1,3 km');});import {connectionStatus,ageText} from '../packages/shared/status.js';
test('connection status prefers recent lastContact over flapping offline flag',()=>{
 const now=Date.parse('2026-11-17T12:00:00Z');
 const online=connectionStatus({status:'online',lastContact:now-30000},now);
 assert.equal(online.state,'online');
 assert.equal(online.label,'Online');
 // Traccar says offline but contact is 2 minutes old → still treated as online.
 const flap=connectionStatus({status:'offline',lastContact:now-120000},now);
 assert.equal(flap.state,'online');
 // 15 minutes since contact → soft "recent" state, not hard offline.
 const recent=connectionStatus({status:'offline',lastContact:now-15*60*1000},now);
 assert.equal(recent.state,'recent');
 assert.match(recent.label,/Senest set/);
 // Stale contact → offline.
 const offline=connectionStatus({status:'offline',lastContact:now-2*60*60*1000},now);
 assert.equal(offline.state,'offline');
 assert.equal(offline.label,'Offline');
 // No contact info at all.
 assert.equal(connectionStatus({status:'unknown'},now).state,'unknown');
 assert.equal(connectionStatus(null,now).state,'unknown');
});
