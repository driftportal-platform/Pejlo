import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gpsStatus} from '../packages/shared/gps-status.js';
import {createGeofenceMonitor} from '../dist/src/features/geofence.js';

test('a clock fault takes precedence over uncertainty while preserving the original position',()=>{
 const now=Date.now(),position={lat:56,lon:8,timestamp:now-38000};
 const data={position,gpsUncertain:true,telemetry:{gpsClockAhead:true}};
 assert.equal(gpsStatus(data,now).label,'Tidsfejl fra trackeren');
 assert.equal(gpsStatus(data,now).waiting,true);
 assert.equal(data.position.timestamp,now-38000);
 const profile={id:'loui',trackerId:'1234',geofenceEnabled:true,homeConfirmed:true,home:{lat:56,lon:8,radius:50,shape:'circle'}};
 const result=createGeofenceMonitor().evaluate(profile,{...data,source:'traccar'},{now});
 assert.match(result.text,/Tidsfejl/);
 assert.equal(result.kind,'unknown');
 assert.equal(result.transition,undefined);
});

test('lookup errors, provisional fixes, rejected coordinates and fresh fixes have distinct status',()=>{
 const now=Date.now(),position={timestamp:now-38000};
 assert.equal(gpsStatus({position,positionLookupFailed:true,gpsUncertain:true},now).label,'Positionsopslag fejlede');
 assert.equal(gpsStatus({position,gpsProvisional:true,gpsUncertain:true},now).label,'Afventer bekræftet position');
 assert.equal(gpsStatus({position,gpsUncertain:true},now).label,'Afventer stabil position');
 assert.equal(gpsStatus({position:{timestamp:now-240000},gpsUncertain:true},now).label,'Usikker GPS-position');
 assert.equal(gpsStatus({position},now).waiting,false);
 assert.equal(gpsStatus({position},now).label,'Seneste registrering');
 assert.equal(gpsStatus({position:{timestamp:now-360000}},now).label,'Gammel position');
 assert.equal(gpsStatus({},now).waiting,true);
});
