import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableMapHeight} from '../apps/web/src/features/map-viewport.js';
test('mobile map fits above fixed navigation instead of placing its centre behind it',()=>{
 const height=availableMapHeight({viewportHeight:844,documentTop:310,navigationTop:754});assert.equal(height,434);assert.ok(310+height<754);
 assert.equal(availableMapHeight({viewportHeight:740,documentTop:260,navigationTop:655}),385);
 assert.equal(availableMapHeight({viewportHeight:844,documentTop:310,navigationTop:754,scrollY:180}),height,'page scrolling must not change the allocated map height');
});
test('map size remains usable in short views and rejects incomplete geometry',()=>{
 assert.equal(availableMapHeight({viewportHeight:400,documentTop:260,navigationTop:320}),160);
 assert.equal(availableMapHeight({viewportHeight:1600,documentTop:250}),720);
 assert.equal(availableMapHeight({viewportHeight:0,documentTop:250}),null);assert.equal(availableMapHeight({viewportHeight:844,documentTop:NaN}),null);
});
