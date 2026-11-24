// Poll account state only while the app is visible. Each adapter belongs to one
// login session; delayed requests can never be sent with a subsequent user's token.
export function createD1StateAdapter({request,setTimer=setTimeout,clearTimer=clearTimeout,visible=()=>!globalThis.document?.hidden}){
 let notify=()=>{},refresh=async()=>{},closed=true,generation=0;
 return {
  ref:uid=>uid,
  listen(ref,ok,error){
   closed=false;const gen=++generation,current=()=>!closed&&gen===generation;let timer,last=null,started=false,running=false;
   refresh=async()=>{
    if(!current()||running)return;running=true;clearTimer(timer);
    try{
     if(started&&!visible())return;
     const data=await request();if(!current())return;
     const serialized=JSON.stringify(data);if(serialized!==last){last=serialized;ok({data});}
     else ok({data,unchanged:true});
     started=true;
    }catch(e){if(current()){if(!started)error(e);else ok({fromCache:true});}}
    finally{running=false;if(current())timer=setTimer(refresh,60000);}
   };
   notify=data=>{if(current()){last=JSON.stringify(data);ok({data});}};
   void refresh();return ()=>{if(gen===generation)closed=true;clearTimer(timer);};
  },
  async transaction(ref,update){
   const gen=generation,current=()=>!closed&&gen===generation;
   if(!current())throw Error('Konto skiftet');
   const remote=await request();if(!current())throw Error('Konto skiftet');notify(remote);
   const value=update(remote);
   try{
    const result=await request({state:value,revision:remote.revision});if(current())notify(result);
   }catch(e){if(e.status===409&&current())await refresh();throw e;}
  }
 };
}
