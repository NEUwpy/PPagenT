import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

function rgb(hex){return /^#[0-9a-f]{6}$/i.test(hex??'')?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)):null;}
function hue([r,g,b]){const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;if(!d)return 0;return ((hi===r?(g-b)/d:hi===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;}
function contains(a,b){return a[0]<=b[0]+.5&&a[1]<=b[1]+.5&&a[0]+a[2]>=b[0]+b[2]-.5&&a[1]+a[3]>=b[1]+b[3]-.5;}
function intersection(a,b){return [Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0]),Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1])];}
export function auditVisibleContract(layout,theme){
  const used=new Map(),primary=rgb(theme.primaryColor),neutral=new Set(Object.values(theme.neutral??{}).map(s=>s.toUpperCase()));
  function scan(value,owner){if(typeof value==='string'&&rgb(value)){const color=value.toUpperCase();used.set(color,[...new Set([...(used.get(color)??[]),owner])]);}else if(value&&typeof value==='object')for(const v of Object.values(value))scan(v,owner);}
  scan(layout.slide?.backgroundColor,'slide-background');
  const elements=[...(layout.elements??[]),...(layout.inheritedLayers??[]).flatMap(l=>l.elements??[])];
  for(const e of elements)scan(e,e.name??e.id);
  const colorIssues=[];
  for(const [color,owners] of used){const c=rgb(color);if(neutral.has(color)||Math.max(...c)-Math.min(...c)<=8)continue;const delta=Math.abs(hue(c)-hue(primary)),distance=Math.min(delta,360-delta);if(distance>15)colorIssues.push({color,owners,hueDistance:Math.round(distance)});}
  const texts=elements.filter(e=>e.text?.trim()&&Array.isArray(e.bbox));
  const fills=elements.filter(e=>e.kind==='shape'&&rgb(e.fillColor)&&Array.isArray(e.bbox)&&!e.text?.trim());
  const paintIssues=[];
  for(const t of texts)for(const s of fills){if(t.id===s.id)continue;const hit=intersection(t.bbox,s.bbox);if(hit[0]<=1||hit[1]<=1)continue;
    const shapeEarlier=(s.order??0)<(t.order??0);
    if(shapeEarlier&&contains(s.bbox,t.bbox))continue;
    // A later full text backing obscures older region boundaries (e.g. a shared
    // conclusion band spanning two columns); those old fills cannot clip text.
    if(shapeEarlier&&fills.some(f=>f.id!==s.id&&(f.order??0)>(s.order??0)&&(f.order??0)<(t.order??0)&&contains(f.bbox,t.bbox)))continue;
    paintIssues.push({text:t.name,shape:s.name,kind:shapeEarlier?'TEXT_FRAME_CROSSES_FILL_EDGE':'LATER_FILL_OVER_TEXT_FRAME',intersection:hit.map(v=>Math.round(v*10)/10),textPreview:t.text.slice(0,80)});
  }
  return {colorIssueCount:colorIssues.length,colorIssues,paintIssueCount:paintIssues.length,paintIssues,
    scope:'Rendered object colors and declared frames only. Hue test detects a second hue, not exact theme derivation. Paint findings require review; no glyph bounds or shape-contour proof.',visualAcceptance:'not assessed'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [themePath,...paths]=process.argv.slice(2);if(!paths.length)throw new Error('Usage: audit-visible-contract.mjs THEME LAYOUT...');const theme=JSON.parse(await fs.readFile(themePath,'utf8'));const results=[];for(const p of paths)results.push({path:p,...auditVisibleContract(JSON.parse(await fs.readFile(p,'utf8')),theme)});console.log(JSON.stringify(results,null,2));}
