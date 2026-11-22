export function createWakeLock({api=navigator.wakeLock,visible=()=>!document.hidden,onState=()=>{}}={}){
 let wanted=false,active=false,handle=null,generation=0;
 async function acquire(){
  if(!wanted||!active||!visible())return;
  if(!api?.request){wanted=false;onState('Skærmlås understøttes ikke i denne browser.');return;}
  const gen=++generation;
  try{const lock=await api.request('screen');if(gen!==generation||!wanted||!active||!visible()){await lock.release();return;}handle=lock;lock.addEventListener('release',()=>{if(handle===lock){handle=null;onState(wanted?'Skærmlåsen er frigivet af telefonen. Slå til igen, hvis nødvendigt.':'Skærmlås slået fra.');}});onState('Skærmen holdes vågen under søgning.');}
  catch{onState('Skærmen kunne ikke holdes vågen. Telefonen kan begrænse funktionen ved lavt batteri.');}
 }
 async function release(){generation++;const lock=handle;handle=null;if(lock)try{await lock.release();}catch{}}
 return {async set(value){wanted=value;await release();if(wanted)await acquire();else onState('Skærmlås slået fra.');},async page(value){if(active===value)return;active=value;await release();if(active)await acquire();},async visibility(){await release();if(visible())await acquire();},async stop(){wanted=false;active=false;await release();onState('Skærmlås slået fra.');}};
}
