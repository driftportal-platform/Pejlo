import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMap} from '../dist/src/features/maps.js';
test('deleted or unconfirmed fences never paint an old polygon or affect map bounds',()=>{
 const drawn=[],bounds=[],lines=[];
 const layer=()=>({addTo(){return this;},clearLayers(){},bindTooltip(){return this;}});
 globalThis.window={L:true};globalThis.document={getElementById:()=>({}),createElement:()=>({})};
 globalThis.L={map:()=>({setView(){return this;},on(){},invalidateSize(){},fitBounds(v){bounds.push(v);},removeLayer(){}}),control:{zoom:()=>layer()},layerGroup:()=>layer(),divIcon:x=>x,imageOverlay:()=>layer(),marker:()=>layer(),polygon:p=>{drawn.push(p);return layer();},circle:()=>{drawn.push('circle');return layer();},polyline:points=>{lines.push(points);return layer();},latLngBounds:x=>x};
 const map=createMap('test'),p={name:'Loui',type:'cat',homeConfirmed:true,home:{lat:56,lon:8,radius:100,shape:'polygon',points:[{lat:57,lon:9},{lat:57.1,lon:9},{lat:57.1,lon:9.1}]}},data={position:null,route:[]};
 map.profile(p,data);assert.equal(drawn.length,1);
 drawn.length=0;p.homeConfirmed=false;map.profile(p,data);map.fit(p,data);
 assert.equal(drawn.length,0);assert.deepEqual(bounds.at(-1),[[56,8]]);
 p.homeConfirmed=true;p.home={lat:56,lon:8,radius:100,shape:'circle'};map.profile(p,data);assert.deepEqual(drawn,['circle']);
 drawn.length=0;lines.length=0;const located={position:{lat:56.001,lon:8},route:[]};map.profile(p,located,{showRoute:false,showHome:false,showRings:true,showDistanceLine:true});assert.equal(drawn.length,3);assert.equal(lines.length,1);
 p.homeConfirmed=false;drawn.length=0;lines.length=0;map.profile(p,located,{showRoute:false,showHome:false,showRings:true,showDistanceLine:true});assert.equal(drawn.length,0);assert.equal(lines.length,0);
 delete globalThis.window;delete globalThis.document;delete globalThis.L;
});
