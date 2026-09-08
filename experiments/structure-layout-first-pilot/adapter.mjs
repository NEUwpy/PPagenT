import {preservedComponent} from '../../src/runtime/preserved-structure-build.mjs';
// Experiment: Layout supplies four equal peer regions; the structure supplies decoration.
// Existing semantic text, icons and original fold curves are reused, not model-redrawn.
export function layoutComponent(source,frame,skin,regions,appearance){
 if(regions.length!==4)throw new Error('Pilot expects four peer regions');
 for(const r of regions){
  if(r.width<250||r.height<135||r.left<0||r.top<0||r.left+r.width>frame.width||r.top+r.height>frame.height)throw new Error('Peer region cannot fit the preserved note design');
 }
 const base=preservedComponent(source,frame,skin);
 return {...base,renderMarkup(content){
  let markup=base.renderMarkup(content),index=0;
  markup=markup.replace(/<article\b[^>]*>/g,tag=>{
   index++;
   return tag.replace(/style="[^"]*"/,'');
  });
  index=0;
  markup=markup.replace(/<svg class="note-sheet"[\s\S]*?<\/svg>/g,sheet=>{
   const {width:w,height:h}=regions[index++];
   if(appearance==='plain')return `<div class="plain-surface" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="plain-surface-${index}" style="position:absolute;inset:0;background:var(--ppagent-color-surface)"></div>`;
   // Pin the original curved fold to bottom-right; main paper expands around it.
   const x=n=>n<630?n/630*(w-88.8):w-(1000-n)*.24;
   const y=n=>n<735?n/735*(h-53):h-(1000-n)*.20;
   sheet=sheet.replace('viewBox="0 0 1000 1000"',`viewBox="0 0 ${w} ${h}"`);
   sheet=sheet.replace(/d="([MLCZ 0-9.,-]+)"/g,(_,d)=>`d="${d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,(_,a,b)=>`${x(+a).toFixed(2)} ${y(+b).toFixed(2)}`)}"`);
   return sheet.replace('width="1000" height="172"',`width="${w}" height="36"`);
  });
  const placements=regions.map((r,i)=>`.notes-adapted .note-card:nth-child(${i+1}){position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;}`).join('');
  const css=`.notes-adapted .notes-grid{display:contents!important}
   ${placements}
   .notes-adapted .note-sheet{overflow:visible}
   .notes-adapted .note-text-region{right:22px;bottom:54px}
   .notes-adapted .note-card[data-has-title="true"] .note-text-region .ppagent-text-primitive--heading{flex-basis:36px;min-height:36px;margin-left:44px;padding:0 16px 0 10px}
   .notes-adapted .note-card[data-has-title="true"] .note-text-region .ppagent-text-primitive--body{margin:16px 20px 0;line-height:1.55}
   .notes-adapted .note-icon-area{width:44px;height:36px}
   .notes-adapted .note-icon-slot{left:12px;top:8px;width:20px;height:20px}
   .notes-adapted .note-icon-svg{width:20px;height:20px}
   .notes-adapted .note-sheet-paper{stroke-width:1}.notes-adapted .note-sheet-fold{stroke-width:1.2}`;
  return markup.replace('</section>',`<style>${css}</style></section>`);
 }};
}
