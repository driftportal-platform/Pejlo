import {gpsPoint} from './gps.js';

// Traccar speed is knots. Use decoded fix time, never receipt time, so delayed
// uploads and clock faults cannot become a fresh resting animal.
export function restObservation(raw){
 const timestamp=Date.parse(raw?.fixTime),received=Date.parse(raw?.serverTime);
 if(!Number.isFinite(timestamp))return null;
 const point=gpsPoint(raw),speed=raw?.speed;
 const valid=!!point&&(!Number.isFinite(received)||timestamp<=received+60000);
 return {timestamp,valid,...(point?{lat:point.lat,lon:point.lon,accuracy:point.accuracy}:{}),speedKph:Number.isFinite(speed)&&speed>=0?speed*1.852:null,charging:typeof raw?.attributes?.charge==='boolean'?raw.attributes.charge:null,satellites:Number.isInteger(raw?.attributes?.sat)?raw.attributes.sat:null};
}
