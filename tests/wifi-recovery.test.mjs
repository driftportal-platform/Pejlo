import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackerWifiScans} from '../apps/api/wifi-observations.js';
import {trackerTelemetry} from '../apps/api/gps.js';
import {wifiObservation} from '../packages/shared/home-wifi.js';
import {rememberWifi} from '../packages/shared/wifi-history.js';
import {createWifiSetup,wifiSetupReadout} from '../packages/shared/wifi-setup.js';
import {createWifiScan} from '../dist/src/features/wifi-discovery.js';
const now=1800000000000,mac='28:BD:89:05:5C:10';
const report=(at,extra={})=>({deviceId:7,serverTime:new Date(at+1000).toISOString(),deviceTime:new Date(at).toISOString(),fixTime:new Date(at).toISOString(),valid:false,network:{wifiAccessPoints:[{macAddress:mac,signalStrength:-49,ssid:'private',secret:'never return'}]},...extra});
const data=scans=>({device:{status:'online'},telemetry:{wifiScans:scans,wifiAccessPoints:[],wifiMeasuredAt:null}});
test('recover Wi-Fi between live polls, scoped to the device, while rejecting future scans and unrelated fields',()=>{
 const rows=[report(now-60000),report(now-30000),report(now-30000),report(now,{deviceId:8}),report(now+60000),report(now,{serverTime:'invalid'})];
 const scans=trackerWifiScans(rows,7,now);assert.equal(scans.length,2);assert.deepEqual(scans[0],{at:now-60000,points:[{mac,rssi:-49}]});
 assert.ok(!JSON.stringify(scans).includes('private'));assert.ok(!JSON.stringify(scans).includes('secret'));
 const current=trackerTelemetry(report(now,{network:{}}),now),last=rememberWifi(null,{...current,wifiScans:scans},now);
 assert.equal(last.at,now-30000);const live={device:{status:'online'},telemetry:{...current,lastWifi:last}};
 assert.equal(wifiObservation(live,{macs:[mac]},now).fresh,true);assert.equal(wifiObservation(live,{macs:[mac]},now).at,last.at);
 assert.equal(wifiObservation(live,{macs:[mac]},now+120001).fresh,false,'a GPS report must not refresh the Wi-Fi timestamp');
});
test('three real recovered scans advance training and discovery once without treating polls as scans',()=>{
 const scans=trackerWifiScans([0,30000,60000].map(n=>report(now-90000+n)),7,now),d=data(scans);
 const setup=createWifiSetup({macs:[mac]},now-100000);assert.equal(setup.observe(d,now),true);assert.equal(setup.snapshot().phase,'inside-ready');assert.equal(setup.snapshot().inside.length,3);assert.equal(setup.observe(d,now),false);
 const scan=createWifiScan();assert.equal(scan.observe(d,now),true);assert.equal(scan.snapshot().scans,3);assert.equal(scan.observe(d,now+1000),false);assert.equal(scan.snapshot().scans,3);
 setup.startOutside(now);assert.equal(setup.observe(d,now),false,'late indoor uploads must not become outdoor samples');
 assert.equal(setup.snapshot().outside.length,0);
});
test('old or offline recovered scans remain visible as history but never train or count as fresh discoveries',()=>{
 const scans=trackerWifiScans([report(now-600000)],7,now),d=data(scans),setup=createWifiSetup({macs:[mac]},now-1000),scan=createWifiScan();
 assert.equal(setup.observe(d,now),false);assert.equal(scan.observe(d,now),false);assert.equal(wifiSetupReadout(d,{macs:[mac]},now).strength,'unknown');
 const offline={...data(trackerWifiScans([report(now-1000)],7,now)),device:{status:'offline'}};
 assert.equal(scan.observe(offline,now),false);assert.equal(setup.observe(offline,now),false);
});
test('a missing device timestamp falls back to fix time rather than making buffered Wi-Fi fresh',()=>{
 const raw=report(now-600000,{deviceTime:null,serverTime:new Date(now).toISOString()});
 assert.equal(trackerTelemetry(raw,now).wifiMeasuredAt,now-600000);
 const d=data(trackerWifiScans([raw],7,now));assert.equal(wifiObservation(d,{macs:[mac]},now).fresh,false);
});
test('setup readout distinguishes home matching, stale data and indoor/outdoor averages',()=>{
 const config={macs:[mac],samples:['inside','outside'].flatMap((label,j)=>[0,1,2].map(i=>({label,at:now-600000+(i+j*3)*30000,points:[{mac,rssi:j?-80:-45}]})))};
 const r=wifiSetupReadout(data([{at:now-1000,points:[{mac,rssi:-49}]}]),config,now);
 assert.equal(r.strength,'strong');assert.equal(r.inside,-45);assert.equal(r.outside,-80);assert.equal(r.difference,35);assert.equal(r.matched,1);
 const other=data([{at:now-1000,points:[{mac:'28:BD:89:05:5C:47',rssi:-20}]}]);assert.equal(wifiSetupReadout(other,config,now).rssi,null);
});
