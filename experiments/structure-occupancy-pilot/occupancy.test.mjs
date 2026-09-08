import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { occupancyFromTree,maturityGroups,collisions,freePlacements } from './occupancy.mjs';
test('actual P3 outline allows useful space but protects level groups and moves with its frame',async()=>{
 const tree=JSON.parse(await fs.readFile(new URL('../structure-wholepage-luna-20260908/luna/P3/P3-attempt-3.tree.json',import.meta.url)));
 const frame={left:56,top:165,width:800,height:390};
 const map=occupancyFromTree(tree,frame,{groups:maturityGroups(tree)});
 assert.equal(map.areas.length,4);
 assert.equal(map.areas.flatMap(a=>a.members).length,tree.nodes.length);
 const candidates=freePlacements(map,frame,{width:290,height:140});
 assert.ok(candidates.length>0);
 assert.deepEqual(collisions(candidates[0],map),[]);
 for(const node of map.nodes)assert.ok(collisions(node.frame,map).length>0,node.name);
 const moved=occupancyFromTree(tree,{...frame,left:156,top:215},{groups:maturityGroups(tree)});
 assert.ok(Math.abs(moved.areas[0].frame.left-map.areas[0].frame.left-100)<.001);
 assert.ok(Math.abs(moved.areas[0].frame.top-map.areas[0].frame.top-50)<.001);
 assert.throws(()=>occupancyFromTree(tree,{...frame,width:700}),/actual target size/);
});
test('rotated objects and zero-height lines are conservatively protected',()=>{
 const tree={frame:{width:200,height:200},nodes:[{name:'rotated',frame:{left:50,top:50,width:100,height:20,rotation:45}},{name:'line',frame:{left:0,top:150,width:100,height:0},line:{width:2}}]};
 const map=occupancyFromTree(tree,{left:0,top:0,width:200,height:200},{padding:10});
 assert.ok(map.areas[0].frame.height>100);
 assert.ok(collisions({left:40,top:145,width:30,height:10},map).includes('line'));
});
