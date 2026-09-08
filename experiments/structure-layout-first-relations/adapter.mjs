import {preservedComponent} from '../../src/runtime/preserved-structure-build.mjs';
const canonical={width:1170,height:492};
const n=v=>Number(v).toFixed(3);
export function layoutComponent(source,frame,skin,layout,appearance){
 const base=preservedComponent(source,canonical,skin);
 return {...base,designFrame:{width:frame.width,height:frame.height},renderMarkup(content){
  let m=base.renderMarkup(content).replace('width:1170px;height:492px',`width:${frame.width}px;height:${frame.height}px`);
  if(source.id==='convergence-simple-funnel')return funnel(m,frame,layout,appearance,content.steps.length);
  if(source.id==='progression-maturity-steps')return ladder(m,frame,layout,appearance,content.levels.length);
  throw new Error('This experiment supports funnel and staircase only');
 }};
}
function funnel(m,frame,l,appearance,count){
 if(l.centers.length!==count)throw new Error('Layer count differs from planned rows');
 const gap=count>=6?5:8,height=(317-gap*(count-1))/count;
 const first=105+height/2,last=first+(height+gap)*(count-1);
 const sy=(l.centers.at(-1)-l.centers[0])/(last-first),sx=l.topWidth/370;
 if(sy<=0||sx<=0)throw new Error('Funnel must converge downward');
 for(let i=0;i<count;i++)if(Math.abs(l.centers[i]-(l.centers[0]+i*(height+gap)*sy))>.1)throw new Error('Rows must keep an even rhythm');
 const x=v=>l.axis+(v-585)*sx,y=v=>l.centers[0]+(v-first)*sy;
 // Adaptive source uses an internal coordinate window; map that same source geometry.
 const view=[585-l.axis/sx,first-l.centers[0]/sy,frame.width/sx,frame.height/sy].map(n).join(' ');
 m=m.replace(/<svg class="simple-funnel-(orbit|diagram)"[^>]*>/g,(_,kind)=>`<svg class="simple-funnel-${kind}" style="width:100%;height:100%" viewBox="${view}" preserveAspectRatio="none">`);
 // Read source positions expressed by preservedComponent at canonical size.
 // At 1170x492, fit origin is zero and scale one, so positions are canonical.
 m=m.replace(/--x:([\d.]+)px;--y:([\d.]+)px;--size:([\d.]+)px/g,(_,a,b,size)=>`--x:${n(x(+a))}px;--y:${n(y(+b))}px;--size:${size}px`);
 let index=0;
 m=m.replace(/<h3 class="simple-step-title"[^>]*>/g,tag=>{
  const i=index++,p=i/count,p1=(i+1)/count;
  const w=((370-282*Math.pow(p,.82))+(370-282*Math.pow(p1,.82)))/2*sx;
  return tag.replace(/style="[^"]*"/,`style="left:${l.axis}px;--top:${l.centers[i]-15}px;--width:${Math.max(88,w-12)}px;height:30px;line-height:30px;display:flex;align-items:center;justify-content:center;white-space:nowrap"`);
 });
 if(appearance==='plain'){
  m=m.replace(/<svg class="simple-funnel-orbit"[\s\S]*?<\/svg>/,'');
  m=m.replace(/<svg class="simple-funnel-diagram"[\s\S]*?<\/svg>/,`<svg class="simple-funnel-diagram" style="width:100%;height:100%" viewBox="0 0 ${frame.width} ${frame.height}">${l.centers.map((cy,i)=>{
   const w=(370-282*Math.pow(i/count,.82))*sx,h=height*sy;
   return `<rect x="${l.axis-w/2}" y="${cy-h/2}" width="${w}" height="${h}" style="fill:var(--ppagent-color-surface);stroke:var(--ppagent-color-line)" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="plain-layer-${i}"/>`;
  }).join('')}</svg>`);
 }
 return m;
}
function ladder(m,frame,l,appearance,count){
 if(l.centers.length!==count)throw new Error('Capability count differs from planned positions');
 const originals=[...m.matchAll(/class="level-index"[^>]*style="left:([\d.]+)px;top:([\d.]+)px;width:([\d.]+)px;height:([\d.]+)px/g)].map(a=>({x:+a[1]+(+a[3])/2,y:+a[2]+(+a[4])/2}));
 if(originals.length!==count)throw new Error('Cannot read original staircase anchors');
 const sx=(l.centers.at(-1).x-l.centers[0].x)/(originals.at(-1).x-originals[0].x);
 const sy=(l.centers.at(-1).y-l.centers[0].y)/(originals.at(-1).y-originals[0].y);
 if(sx<=0||sy<=0)throw new Error('Staircase must retain its rising direction');
 const x=v=>l.centers[0].x+(v-originals[0].x)*sx,y=v=>l.centers[0].y+(v-originals[0].y)*sy;
 for(let i=0;i<count;i++)if(Math.abs(x(originals[i].x)-l.centers[i].x)>1||Math.abs(y(originals[i].y)-l.centers[i].y)>1)throw new Error('Planned anchors must preserve staircase rhythm');
 const copy=l.centers.map(c=>({left:c.x-l.copyWidth/2,top:c.y-145,width:l.copyWidth,height:112}));
 m=m.replace(/<svg class="ladder-art"[\s\S]*?<\/svg>/,svg=>{
  svg=svg.replace('viewBox="0 0 1170 492"',`viewBox="0 0 ${frame.width} ${frame.height}"`);
  svg=svg.replace(/points="([^"]*)"/g,(_,points)=>`points="${points.split(/\s+/).map(p=>{const [a,b]=p.split(',').map(Number);return `${n(x(a))},${n(y(b))}`;}).join(' ')}"`);
  svg=svg.replace(/\b(x1|x2|y1|y2)="([\d.]+)"/g,(_,key,v)=>`${key}="${n(key.startsWith('x')?x(+v):y(+v))}"`);
  if(appearance==='plain')return `<svg class="ladder-art" viewBox="0 0 ${frame.width} ${frame.height}"><polyline points="${l.centers.map(c=>`${c.x},${c.y}`).join(' ')}" style="fill:none;stroke:var(--ppagent-color-muted);stroke-width:2" data-ppt-kind="path" data-ppt-name="plain-progression"/>${copy.map((f,i)=>`<rect x="${f.left}" y="${f.top}" width="${f.width}" height="${f.height}" style="fill:var(--ppagent-color-surface)" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="plain-level-${i}"/>`).join('')}</svg>`;
  return svg.replace(/<polygon class="level-support"[^>]*>/g,tag=>{
   const i=Number(tag.match(/maturity-level-support-(\d+)/)[1])-1,f=copy[i];
   const pts=[[.06,.14],[1,0],[.94,.86],[0,1]].map(([a,b])=>`${f.left+f.width*a},${f.top+f.height*b}`).join(' ');
   return tag.replace(/points="[^"]*"/,`points="${pts}"`);
  });
 });
 let i=0;
 m=m.replace(/class="ppagent-text-region level-copy" style="[^"]*"/g,()=>{
  const f=copy[i++];return `class="ppagent-text-region level-copy" style="left:${f.left}px;top:${f.top}px;width:${f.width}px;height:${f.height}px"`;
 });
 i=0;
 m=m.replace(/<div class="level-index"[^>]*>/g,tag=>{
  const c=l.centers[i++];return tag.replace(/style="[^"]*"/,`style="left:${c.x-20}px;top:${c.y-20}px;width:40px;height:40px;border-width:2px"`);
 });
 m=m.replace(/(<div class="status-tag [^"]+"[^>]*style=")left:([\d.]+)px;top:([\d.]+)px/g,(_,start,a,b)=>`${start}left:${n(x(+a+29)-29)}px;top:${n(y(+b-27)+28)}px`);
 return m.replace('</section>','<style>.maturity-ladder .status-tag{width:58px;text-align:center}</style></section>');
}
