import {once} from './schema.js';
import {batteryHistory} from '../../packages/shared/battery-history.js';
export function batteryEventsSchema(db){return once(db,'batteryEvents',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_battery_events(identifier TEXT NOT NULL,at INTEGER NOT NULL,seconds INTEGER NOT NULL,status TEXT NOT NULL,PRIMARY KEY(identifier,at))').run());}
export async function getBatteryHistory({env,identifier,device,traccar,now=Date.now(),days=1}){
 if(![1,7].includes(days))throw Object.assign(Error('Vælg 24 timer eller 7 dage.'),{status:400});
 const from=now-days*86400000;
 const raw=await traccar('/api/reports/route?'+new URLSearchParams({deviceId:String(device.id),from:new Date(from).toISOString(),to:new Date(now).toISOString()}));
 if(!Array.isArray(raw))throw Object.assign(Error('Batterihistorikken kunne ikke hentes.'),{status:502});
 const truncated=raw.length>10000;
 const result=batteryHistory(raw.slice(0,10000),from,now,device.id,days);
 await batteryEventsSchema(env.DB);
 const events=await env.DB.prepare('SELECT at,seconds,status FROM pejlo_battery_events WHERE identifier=? AND at>=? ORDER BY at DESC LIMIT 100').bind((env.TRACCAR_SOURCE||'environment')+':'+identifier,from).all();
 return {...result,truncated,changes:events.results||[]};
}
