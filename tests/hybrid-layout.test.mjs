import test from 'node:test';
import assert from 'node:assert/strict';
import {composePageLayout,resolvePageLayout} from '../src/visual-runtime/page-layout-library.mjs';
test('hybrid solves both nesting orientations and keeps leaves inside canvas',()=>{
 for(const id of ['hybrid-row-band','hybrid-column-aside']){
  const r=resolvePageLayout(id);assert.equal(r.slots.length,4);
  for(const b of r.slots)assert(b.x>=0&&b.y>=0&&b.x+b.width<=1170.001&&b.y+b.height<=492.001);
 }
 const a=resolvePageLayout('hybrid-row-band').slots;assert.equal(a[0].y,a[2].y);assert(a[3].y>a[0].y);
 const b=resolvePageLayout('hybrid-column-aside').slots;assert.equal(b[0].x,b[2].x);assert(b[3].x>b[0].x);
});
test('hybrid rejects duplicate or missing leaves and unsatisfied minimum size',()=>{
 const spec={family:'hybrid',blocks:[{},{}],tree:{direction:'vertical',children:[{block:0},{block:0}]}};
 assert.throws(()=>composePageLayout(spec),/重复/);
 spec.tree={block:0};assert.throws(()=>composePageLayout(spec),/遗漏/);
 spec.tree={direction:'horizontal',children:[{block:0},{block:1}]};spec.blocks[0].minWidth=2000;
 assert.throws(()=>composePageLayout(spec),/最小尺寸/);
});
