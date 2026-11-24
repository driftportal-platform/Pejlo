import {once} from './schema.js';
import {commandWasRejected} from './tracker-actions.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export async function sendPositionRequest({db,identifier,device,traccar,traccarFetch,now=Date.now()}){
   if(device.status!=='online')fail(409,'Trackeren har ingen aktiv forbindelse. Prøv igen, når den er online.');

   const types=await traccar('/api/commands/types?'+new URLSearchParams({deviceId:String(device.id),textChannel:'false'}));

   if(!Array.isArray(types)||!types.some(command=>command.type==='positionSingle'))fail(409,'Traccar tilbyder ikke enkelt positionsrapport for denne tracker.');

   await once(db,'positionRequests',()=>db.prepare('CREATE TABLE IF NOT EXISTS pejlo_position_requests (identifier TEXT PRIMARY KEY, requested_at INTEGER NOT NULL)').run());

   const requestedAt=now;

   const reserved=await db.prepare(`INSERT INTO pejlo_position_requests (identifier,requested_at) VALUES (?,?)

    ON CONFLICT(identifier) DO UPDATE SET requested_at=excluded.requested_at

    WHERE pejlo_position_requests.requested_at<=? RETURNING identifier`).bind(identifier,requestedAt,requestedAt-60000).first();

   if(!reserved)fail(429,'Vent et minut mellem forespørgsler.');

   const response=await traccarFetch('/api/commands/send',{method:'POST',body:JSON.stringify({

    deviceId:device.id,type:'positionSingle',textChannel:false,attributes:{noQueue:true}

   })});

   if(response.status===202)return {status:'queued',requestedAt};

   if(!response.ok){

    if(commandWasRejected(response.status)){

     await db.prepare('UPDATE pejlo_position_requests SET requested_at=0 WHERE identifier=? AND requested_at=?')

      .bind(identifier,requestedAt).run();

    }

    fail(502,'Traccar kunne ikke bekræfte positionsforespørgslen. Kontrollér trackerens forbindelse.');

   }

   return {status:'sent',requestedAt};

}
