import {normalizeAccountState,assertRevision} from './account-state.js';
// Adapter is injected so account boundaries and revision checks can be tested.
export function createCloudState(api){
 let generation=0,unsubscribe=()=>{},current=null;
 function close(){generation++;unsubscribe();unsubscribe=()=>{};current=null;}
 function open(user,handlers){
  close();const gen=generation;
  if(!user?.uid||!user.emailVerified)throw new Error('Log ind, og bekræft e-mail først.');
  const session={uid:user.uid,revision:0,ready:false,busy:false,last:null,online:false};current=session;
  const ref=api.ref(user.uid);
  unsubscribe=api.listen(ref,snap=>{
   if(gen!==generation)return;
   if(snap.fromCache){session.online=false;handlers.connection(false);return;}
   if(snap.pending)return;
   const raw=snap.data??{};
   session.last={state:normalizeAccountState(raw),revision:raw.revision??0};session.ready=true;
   session.online=true;handlers.connection(!session.busy);
   if(!session.busy){session.revision=session.last.revision;handlers.state(session.last.state);}
  },error=>{if(gen===generation){session.ready=false;handlers.error(error);}});
  return async value=>{
   if(gen!==generation||!session.ready||!session.online||session.busy)throw new Error('Kontoen er ikke klar til at gemme.');
   const payload=normalizeAccountState(value),expected=session.revision;
   session.busy=true;handlers.busy(true);
   try{
    await api.transaction(ref,remote=>{assertRevision(remote?.revision,expected);return {...payload,revision:expected+1};});
    if(gen!==generation)return;
    session.revision=expected+1;
    if(session.last?.revision>session.revision){session.revision=session.last.revision;handlers.state(session.last.state);}
    handlers.saved();
   }catch(e){
    if(gen===generation&&session.last){session.revision=session.last.revision;handlers.state(session.last.state);}
    throw e;
   }finally{if(gen===generation){session.busy=false;handlers.busy(false);handlers.connection(session.online);}}
  };
 }
 return {open,close};
}
