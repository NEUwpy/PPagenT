import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { convergenceGeometry } from './core.mjs';
import { planConvergence } from './adapter.mjs';
const checks = [];
// Check observable curves independently: near-result direction and band spread,
// not merely stored control-point values or the number of paths.
for (const width of [300, 500, 700]) {
  const m = convergenceGeometry({ starts: [{x:0,y:0},{x:0,y:150},{x:0,y:300}], end:{x:width,y:150} });
  assert(m.ok);
  for (const lane of m.lanes) {
    const p = lane.points;
    const last = p.at(-1), previous = p.at(-2);
    assert(Math.abs((last.y - previous.y) / (last.x - previous.x)) < 0.08);
    assert(p.every((point, i) => i === 0 || point.x >= p[i-1].x));
  }
  const nearEndYs = m.lanes.map(l => l.points[58].y);
  assert(Math.max(...nearEndYs) - Math.min(...nearEndYs) < 10);
  checks.push({width, mergeVisualGeometry:true});
}
assert.equal(convergenceGeometry({starts:[{x:0,y:0},{x:0,y:300}],end:{x:80,y:150}}).ok,false);
const inputs = ['现场记录','检测记录','备件记录'].map(title => ({title,body:'故障现象与发生时间'}));
const args = { frame:{left:62,top:180,width:700,height:410},inputs,result:{title:'维修交接单',body:'接班人员追溯处理过程'},inputWidth:210,resultWidth:180 };
assert(planConvergence(args).ok);
assert.equal(planConvergence({...args,frame:{...args.frame,width:480}}).reason,'insufficient-convergence-space');
assert.equal(planConvergence({...args,frame:{...args.frame,height:200}}).reason,'insufficient-text-height');
const long = planConvergence({...args,inputs:inputs.map(n=>({...n,body:'记录故障发生时间、设备运行状态以及现场处理过程，保留接班人员需要复查的信息。'}))});
assert.equal(long.reason,'insufficient-text-height');
checks.push({tooNarrowRejected:true,tooShortRejected:true,longCopyRequestsHeight:true});
await fs.writeFile(new URL('./core-checks.json',import.meta.url),JSON.stringify(checks,null,2));
console.log('PASS: visual geometry, narrow/short rejection, text-driven height');
