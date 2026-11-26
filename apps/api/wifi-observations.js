import {trackerTelemetry} from './gps.js';
// Routes already authorized for this tracker may contain scans between live polls.
// Do not expose other positions or substitute arrival time for measurement time.
export function trackerWifiScans(rows,deviceId,now=Date.now()){
 const scans=new Map();
 for(const raw of rows){
  if(raw?.deviceId!==deviceId||!Array.isArray(raw?.network?.wifiAccessPoints)||!raw.network.wifiAccessPoints.length)continue;
  const t=trackerTelemetry(raw,now);
  if(t.receivedAt===null||t.wifiMeasuredAt===null||!t.wifiAccessPoints.length)continue;
  scans.set(t.wifiMeasuredAt,{at:t.wifiMeasuredAt,points:t.wifiAccessPoints});
 }
 return [...scans.values()].sort((a,b)=>a.at-b.at).slice(-64);
}
