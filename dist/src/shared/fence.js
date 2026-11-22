import {validPoint,distance} from './geo.js';
const cross=(a,b,c)=>(b.lon-a.lon)*(c.lat-a.lat)-(b.lat-a.lat)*(c.lon-a.lon);
export function validPolygon(points){
 if(!Array.isArray(points)||points.length<3||points.length>50||!points.every(validPoint))return false;
 if(points.some(p=>distance(points[0],p)>20000))return false;
 let area=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];if(distance(a,b)<1)return false;
  area+=a.lon*b.lat-b.lon*a.lat;
  for(let j=i+1;j<points.length;j++){
   if(j===i+1||(i===0&&j===points.length-1))continue;
   const c=points[j],d=points[(j+1)%points.length];
   if(Math.max(a.lon,b.lon)>=Math.min(c.lon,d.lon)&&Math.max(c.lon,d.lon)>=Math.min(a.lon,b.lon)&&Math.max(a.lat,b.lat)>=Math.min(c.lat,d.lat)&&Math.max(c.lat,d.lat)>=Math.min(a.lat,b.lat)&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return false;
  }
 }
 return Math.abs(area)>1e-10;
}
// Positive distance is outside; negative is inside. Local polygons limited to 20 km.
export function fenceDistance(home,p){
 if(home.shape!=='polygon')return distance(home,p)-home.radius;
 const pts=home.points;let inside=false,min=Infinity;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const a=pts[j],b=pts[i];
  if((a.lat>p.lat)!==(b.lat>p.lat)&&p.lon<(b.lon-a.lon)*(p.lat-a.lat)/(b.lat-a.lat)+a.lon)inside=!inside;
  const k=Math.cos(p.lat*Math.PI/180),ax=(a.lon-p.lon)*111195*k,ay=(a.lat-p.lat)*111195,bx=(b.lon-p.lon)*111195*k,by=(b.lat-p.lat)*111195;
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy)));
  min=Math.min(min,Math.hypot(ax+t*dx,ay+t*dy));
 }
 return inside?-min:min;
}
