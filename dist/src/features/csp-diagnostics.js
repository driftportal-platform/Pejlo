// Report diagnostics only to developers. Never show raw URLs or policy reports in the UI.
export function installCspDiagnostics(target=document,logger=console){
 const seen=new Set();
 target.addEventListener('securitypolicyviolation',event=>{
  try{
   let origin='inline/andet';try{origin=new URL(event.blockedURI).origin;}catch{}
   const directive=String(event.violatedDirective).slice(0,80),key=directive+'|'+origin;
   if(seen.has(key)||seen.size>=5)return;seen.add(key);
   logger.warn('Pejlo CSP',event.disposition,directive,origin);
  }catch{/* Diagnostics must never interrupt the application. */}
 });
}
