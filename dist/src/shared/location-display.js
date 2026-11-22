// Keep approximate coordinates separate from trusted GPS used by routes and alerts.
export function displayPosition(data,now=Date.now()){
 const gps=data?.position,estimate=data?.approximatePosition;
 if(data?.mobileLocationEnabled===true&&estimate?.approximate===true&&
    Number.isFinite(estimate.accuracy)&&estimate.accuracy>0&&
    Number.isFinite(estimate.timestamp)&&estimate.timestamp<=now+60000&&now-estimate.timestamp<=300000&&
    (!gps||now-gps.timestamp>300000)&&(!gps||estimate.timestamp>gps.timestamp))return estimate;
 return gps||null;
}
export function approximateText(point){
 if(!point?.approximate)return '';
 const radius=point.accuracy>=1000?(point.accuracy/1000).toLocaleString('da-DK',{maximumFractionDigits:1})+' km':Math.round(point.accuracy)+' m';
 return 'Omtrentlig mobil-/Wi-Fi-placering · usikkerhedsradius ca. '+radius+'. Området er et estimat, ikke en præcis position.';
}
