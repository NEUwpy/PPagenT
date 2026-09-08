import test from 'node:test';
import assert from 'node:assert/strict';
import {scanRemainingPage} from './scan.mjs';
const page={left:0,top:0,width:100,height:100};
const scan=frames=>scanRemainingPage({areas:frames.map(frame=>({frame}))},page);
test('empty and fully occupied pages',()=>{
 assert.equal(scan([]).freeArea,10000);
 assert.deepEqual(scan([]).bands,[{top:0,height:100,free:[{left:0,width:100}]}]);
 assert.equal(scan([page]).freeArea,0);
});
test('subtract union, clip out-of-page obstacles, retain diagonal free sides',()=>{
 const result=scan([{left:-10,top:10,width:40,height:40},{left:20,top:30,width:40,height:40},{left:200,top:0,width:10,height:10}]);
 assert.equal(result.freeArea,7400);
 assert.deepEqual(result.bands.find(b=>b.top===30).free,[{left:60,width:40}]);
 assert.deepEqual(result.bands.find(b=>b.top===50).free,[{left:0,width:20},{left:60,width:40}]);
 // Independent per-pixel oracle: no double-counting overlaps or losing free islands.
 const frames=[{left:-10,top:10,width:40,height:40},{left:20,top:30,width:40,height:40}];
 let count=0;
 for(let y=.5;y<100;y++)for(let x=.5;x<100;x++){
  const expected=!frames.some(f=>x>=f.left&&x<f.left+f.width&&y>=f.top&&y<f.top+f.height);
  const band=result.bands.find(b=>y>=b.top&&y<b.top+b.height);
  assert.equal(band.free.some(f=>x>=f.left&&x<f.left+f.width),expected);
  if(expected)count++;
 }
 assert.equal(result.freeArea,count);
});
