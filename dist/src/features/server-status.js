export function createServerStatus({element,request,doc=document,setTimer=setTimeout,clearTimer=clearTimeout}){
 let generation=0,timer,active=false,busy=false;
 function show(state,text){element.dataset.state=state;element.textContent=text;}
 async function poll(){
  if(!active||doc.hidden||busy)return;
  const gen=generation;busy=true;show('checking','Kontrollerer server');
  try{const result=await request();if(gen!==generation)return;show(result.online?'online':'offline',result.online?'Server online':'Server kan ikke kontaktes');}
  catch{if(gen===generation)show('offline','Server kan ikke kontaktes');}
  finally{if(gen===generation){busy=false;timer=setTimer(poll,30000);}}
 }
 function visibility(){clearTimer(timer);if(!doc.hidden){if(busy)return;poll();}else show('checking','Serverstatus afventer kontrol');}
 function stop(){active=false;generation++;busy=false;clearTimer(timer);doc.removeEventListener('visibilitychange',visibility);show('checking','Kontrollerer server');}
 function start(){stop();active=true;doc.addEventListener('visibilitychange',visibility);poll();}
 return {start,stop};
}
