// Conservative, measured occupied areas. This prototype does not infer semantics
// from pixels and does not treat a whole component frame as an obstacle.
export function intersects(a,b){return a.left<b.left+b.width&&b.left<a.left+a.width&&a.top<b.top+b.height&&b.top<a.top+a.height;}
export function unionFrame(frames){const left=Math.min(...frames.map(f=>f.left)),top=Math.min(...frames.map(f=>f.top));return {left,top,width:Math.max(...frames.map(f=>f.left+f.width))-left,height:Math.max(...frames.map(f=>f.top+f.height))-top};}
function measuredBox(node,target){
 const f=node.frame;
 if(!f||!['left','top','width','height'].every(k=>Number.isFinite(f[k]))||f.width<0||f.height<0)throw new Error(`Missing measured frame: ${node.name}`);
 const angle=(f.rotation??0)*Math.PI/180;
 const width=Math.abs(f.width*Math.cos(angle))+Math.abs(f.height*Math.sin(angle));
 const height=Math.abs(f.width*Math.sin(angle))+Math.abs(f.height*Math.cos(angle));
 const stroke=Math.max(0,node.line?.width??0)/2;
 return {left:target.left+f.left+(f.width-width)/2-stroke,top:target.top+f.top+(f.height-height)/2-stroke,width:width+stroke*2,height:height+stroke*2};
}
export function occupancyFromTree(tree,target,{padding=14,groups=[]}={}){
 if(!Number.isFinite(padding)||padding<0)throw new Error('Invalid occupancy padding');
 if(Math.abs(tree.frame.width-target.width)>.05||Math.abs(tree.frame.height-target.height)>.05)throw new Error('Measure at the actual target size before computing occupancy');
 const nodes=tree.nodes.map(n=>({name:n.name,frame:measuredBox(n,target)}));
 const assigned=new Set(),areas=[];
 for(const group of groups){
  const members=nodes.filter(n=>group.names.includes(n.name));
  if(!members.length)throw new Error(`Empty occupied group: ${group.name}`);
  members.forEach(n=>assigned.add(n.name));
  areas.push({name:group.name,kind:'protected-group',members:members.map(n=>n.name),frame:unionFrame(members.map(n=>n.frame))});
 }
 areas.push(...nodes.filter(n=>!assigned.has(n.name)).map(n=>({name:n.name,kind:'object',members:[n.name],frame:n.frame})));
 return {schemaVersion:1,method:'measured-object-boxes-with-protected-groups',positionFrame:target,padding,
  actualBounds:unionFrame(nodes.map(n=>n.frame)),nodes,areas:areas.map(a=>({...a,frame:{left:a.frame.left-padding,top:a.frame.top-padding,width:a.frame.width+2*padding,height:a.frame.height+2*padding}}))};
}
export function collisions(frame,occupancy){return occupancy.areas.filter(a=>intersects(frame,a.frame)).map(a=>a.name);}
// P3-specific membership, not a general rule for all structures. Derive status
// affiliation from its measured nearest numbered node, not copied coordinates.
export function maturityGroups(tree){
 const indices=tree.nodes.filter(n=>/^maturity-level-index-\d+$/.test(n.name));
 const groups=indices.map(n=>{const id=n.name.match(/\d+$/)[0];return {name:`level-${id}`,names:tree.nodes.filter(x=>x.name.match(new RegExp(`^(?:maturity-(?:level-(?:support|index)|step-(?:riser|top|inset|projection))-${id}|level-${id}-text-(?:heading|body))$`))).map(x=>x.name)};});
 for(const status of tree.nodes.filter(n=>/^maturity-(?:current|target)-status$/.test(n.name))){
  const center=n=>({x:n.frame.left+n.frame.width/2,y:n.frame.top+n.frame.height/2});
  const p=center(status);const nearest=[...indices].sort((a,b)=>Math.hypot(center(a).x-p.x,center(a).y-p.y)-Math.hypot(center(b).x-p.x,center(b).y-p.y))[0];
  groups.find(g=>g.names.includes(nearest.name)).names.push(status.name);
 }
 return groups;
}
export function freePlacements(occupancy,region,{width,height,step=16}={}){
 if(![width,height,step].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid placement dimensions');
 const candidates=[];
 for(let top=region.top;top+height<=region.top+region.height;top+=step)
  for(let left=region.left;left+width<=region.left+region.width;left+=step){const frame={left,top,width,height};if(!collisions(frame,occupancy).length)candidates.push(frame);}
 return candidates;
}
