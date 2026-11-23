export function batteryHistory(raw,from,to,deviceId,days=1){
 const bins=days===7?7:24,step=(to-from)/bins;
 const buckets=Array.from({length:bins},(_,i)=>({at:from+i*step,count:0,battery:null,charging:null}));
 const seen=new Set(),measurements=[];let count=0;
 for(const p of raw){
  const at=Date.parse(p?.fixTime);
  if(p?.deviceId!==deviceId||!Number.isFinite(at)||at<from||at>to)continue;
  const key=Number.isSafeInteger(p.id)?p.id:JSON.stringify([at,p.latitude,p.longitude]);
  if(seen.has(key))continue;seen.add(key);count++;
  const bucket=buckets[Math.min(bins-1,Math.floor((at-from)/step))];bucket.count++;
  const level=p.attributes?.batteryLevel;
  if(Number.isFinite(level)&&level>=0&&level<=100)measurements.push({at,level,charging:typeof p.attributes.charge==='boolean'?p.attributes.charge:null});
 }
 measurements.sort((a,b)=>a.at-b.at);
 for(const m of measurements){const b=buckets[Math.min(bins-1,Math.floor((m.at-from)/step))];b.battery=m.level;b.charging=m.charging;}
 return {from,to,count,buckets,measurements:measurements.slice(-3000),first:measurements[0]||null,last:measurements.at(-1)||null};
}
