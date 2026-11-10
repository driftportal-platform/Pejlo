// No Traccar credential is ever sent to the browser or stored in profile documents.
export function createTrackerClient({fetcher=fetch,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let generation=0,timer,controller;
 function stop(){generation++;clearTimer(timer);controller?.abort();}
 function start(user,identifier,onData,onError,findUntil=0){
  stop();const gen=generation;
  let nextRouteAt=0;
  async function poll(){
   controller=new AbortController();const active=controller;
   const timeout=setTimer(()=>active.abort(),40000);
   try{
    const token=await user.getIdToken();if(gen!==generation)return;
    const live=Date.now()<findUntil&&Date.now()<nextRouteAt;
    const response=await fetcher('/api/tracker?identifier='+encodeURIComponent(identifier)+(live?'&live=1':''),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:active.signal});
    const value=await response.json();if(gen!==generation)return;
    if(!response.ok)throw new Error(value.error||'Trackerdata kunne ikke hentes.');
    if(value.source!=='traccar'||!value.device?.identifier)throw new Error('Trackerdata har et ukendt format.');
    if(!live)nextRouteAt=Date.now()+60000;
    onData(value,live);
   }catch(error){if(gen===generation)onError(error.name==='AbortError'?'Forbindelsen tog for lang tid. Prøv igen.':error.message);}
   finally{clearTimer(timeout);if(gen===generation)timer=setTimer(poll,Date.now()<findUntil?10000:60000);}
  }
  poll();
 }
 return {start,stop};
}
