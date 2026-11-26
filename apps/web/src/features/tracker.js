export function createTrackerClient({
 fetcher=fetch,setTimer=setTimeout,clearTimer=clearTimeout,
 visibility=globalThis.document,routeInterval=()=>60000
}={}){
 let stopCurrent=()=>{},requestRoute=async()=>false;
 function stop(){stopCurrent();stopCurrent=()=>{};requestRoute=async()=>false;}
 function start(user,identifier,onData,onError,findUntil=0){
  stop();
  let stopped=false,timer,controller,inFlight,lastRouteAt=null,failures=0;
  const canPoll=()=>!stopped&&!visibility?.hidden;
  function poll(){
   if(!canPoll()||inFlight)return inFlight;
   clearTimer(timer);
   const active=new AbortController();
   controller=active;
   inFlight=fetchUpdate(active).finally(()=>{
    controller=null;inFlight=null;
    if(!canPoll())return;
    if(active.signal.aborted&&active.signal.reason==='hidden'){poll();return;}
    const interval=Date.now()<findUntil?10000:15000;
    timer=setTimer(poll,Math.min(120000,interval*2**Math.min(failures,3)));
   });
   return inFlight;
  }
  async function fetchUpdate(active){
   const timeout=setTimer(()=>active.abort(),40000);
   try{
    const token=await user.getIdToken();
    if(stopped||active.signal.reason==='hidden')return false;
    active.signal.throwIfAborted();
    const live=lastRouteAt!==null&&Date.now()-lastRouteAt<routeInterval();
    const response=await fetcher('/api/tracker?identifier='+encodeURIComponent(identifier)+(live?'&live=1':''),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:active.signal});
    const value=await response.json();
    if(stopped||active.signal.reason==='hidden')return false;
    active.signal.throwIfAborted();
    if(!response.ok)throw new Error(value.error||'Trackerdata kunne ikke hentes.');
    if(value.source!=='traccar'||!value.device?.identifier)throw new Error('Trackerdata har et ukendt format.');
    if(!live)lastRouteAt=Date.now();
    failures=0;
    onData(value,live);
    return !live&&value.historyAvailable!==false;
   }catch(error){
    if(!stopped&&active.signal.reason!=='hidden'){
     failures++;
     onError(error.name==='AbortError'?'Forbindelsen tog for lang tid. Prøv igen.':error.message);
    }
    return false;
   }finally{clearTimer(timeout);}
  }
  function visibilityChanged(){
   if(visibility.hidden){clearTimer(timer);controller?.abort('hidden');}
   else poll();
  }
  visibility?.addEventListener('visibilitychange',visibilityChanged);
  stopCurrent=()=>{
   stopped=true;
   visibility?.removeEventListener('visibilitychange',visibilityChanged);
   clearTimer(timer);
   controller?.abort();
  };
  requestRoute=async()=>{
   const previous=inFlight;
   if(previous&&await previous)return canPoll();
   if(!canPoll())return false;
   lastRouteAt=null;
   return await poll();
  };
  poll();
 }
 return {start,stop,refreshRoute:()=>requestRoute()};
}
