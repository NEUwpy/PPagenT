import fs from 'node:fs/promises';
import {laneGeometry} from './run/adaptive-component.mjs';
const rows=[[700,470],[650,400],[600,320],[480,250]].map(([width,height])=>{
 const m=laneGeometry({left:0,top:0,width,height});
 const outside=[...m.inputs,m.result].filter(b=>b.left<0||b.top<0||b.left+b.width>width||b.top+b.height>height);
 return {width,height,outsideCount:outside.length,curveSpan:m.merge.x-(m.inputs[0].left+m.inputs[0].width)};
});
await fs.writeFile(new URL('./geometry-probe.json',import.meta.url),JSON.stringify({scope:'Geometry only; does not verify text fit or appearance at alternative sizes',rows},null,2));
console.log(JSON.stringify(rows));
