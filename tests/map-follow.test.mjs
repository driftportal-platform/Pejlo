import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMap} from '../dist/src/features/maps.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {displayPosition} from '../packages/shared/location-display.js';

test('overview follows changed fixes, respects manual pause and pauses while editing a home area',()=>{
 const source=readFileSync('apps/web/src/app.js','utf8');
 const render=source.slice(source.indexOf('let overviewFollowPoint='),source.indexOf('function showPage('));
 const controls=new Map();const $=id=>{if(!controls.has(id))controls.set(id,{checked:false,setAttribute(){}});return controls.get(id);};
 const moves=[];const map={profile(){},center:point=>moves.push(['center',point]),follow:point=>moves.push(['follow',point])};
 let point={lat:56,lon:8,timestamp:Date.now()};
 const context={$,overviewMap:map,overviewOptionsKey:null,selected:()=>({id:'loui',trackerId:'1234'}),data:()=>({position:point}),displayPosition,labelLayer(){},currentPage:'kort',polygonDraft:null,choosingHome:false};
 runInNewContext(render+';this.renderMap=renderMap;',context);
 context.renderMap(map);assert.equal(moves.at(-1)[0],'center');
 point={...point,lat:56.001};context.renderMap(map);assert.equal(moves.at(-1)[0],'follow');assert.equal(moves.at(-1)[1].lat,56.001);
 $('#follow-tracker').checked=false;point={...point,lat:56.002};const paused=moves.length;context.renderMap(map);assert.equal(moves.length,paused);
 $('#follow-tracker').checked=true;context.renderMap(map);assert.equal(moves.at(-1)[1].lat,56.002);
 context.choosingHome=true;point={...point,lat:56.003};const editing=moves.length;context.renderMap(map);assert.equal(moves.length,editing);
 context.choosingHome=false;context.renderMap(map);assert.equal(moves.at(-1)[1].lat,56.003);
 const unchanged=moves.length;context.renderMap(map);assert.equal(moves.length,unchanged,'unchanged fixes do not keep panning');
});

test('following pans without resetting zoom; estimates fit their radius and manual dragging signals pause',()=>{
 const previous={L:globalThis.L,window:globalThis.window,document:globalThis.document};
 const events={},calls=[],circles=[];
 const map={setView(point,zoom){calls.push(['view',point,zoom]);return this;},on(name,callback){events[name]=callback;},invalidateSize(){},panTo(point){calls.push(['pan',point]);},fitBounds(bounds,options){calls.push(['bounds',bounds,options]);}};
 const layer=()=>({addTo(){return this;},clearLayers(){},bindTooltip(){return this;}});
 globalThis.L={map:()=>map,control:{zoom:layer},layerGroup:layer,imageOverlay:layer,divIcon:()=>({}),marker:layer,
  latLng:(lat,lon)=>({toBounds:diameter=>({point:[lat,lon],radius:diameter/2})}),
  circle:(point,options)=>{circles.push(options);let mounted=false;return {...layer(),addTo(){mounted=true;return this;},getBounds(){if(!mounted)throw Error('Leaflet Circle.getBounds requires _map');return {point,radius:options.radius};}};}};
 globalThis.window={L:globalThis.L};globalThis.document={getElementById:()=>({}),createElement:()=>({})};
 try{
  let manual=0;const view=createMap('map',{onManual:()=>manual++});
  view.center({lat:56,lon:8});assert.deepEqual(calls.at(-1),['view',[56,8],18]);
  const before=calls.filter(v=>v[0]==='view').length;
  view.follow({lat:56.01,lon:8.01});assert.deepEqual(calls.at(-1),['pan',[56.01,8.01]]);
  assert.equal(calls.filter(v=>v[0]==='view').length,before,'new fixes must preserve the chosen zoom');
  events.dragstart();assert.equal(manual,1);
  const point={lat:56,lon:8,approximate:true,accuracy:1200};
  view.center(point);assert.equal(calls.at(-1)[1].radius,1200);assert.equal(calls.at(-1)[2].maxZoom,18);
  const circleCount=circles.length;
  view.center({...point,accuracy:33});assert.deepEqual(calls.at(-1),['bounds',{point:[56,8],radius:33},{padding:[35,35],maxZoom:18,animate:false}]);
  assert.equal(circles.length,circleCount,'centering must not create a detached Leaflet circle');
  view.profile({name:'Loui',type:'cat',homeConfirmed:false},{position:point,route:[]});
  assert.equal(circles.at(-1).radius,1200);assert.ok(circles.at(-1).dashArray,'estimates have a visibly different uncertainty circle');
 }finally{Object.assign(globalThis,previous);}
});

