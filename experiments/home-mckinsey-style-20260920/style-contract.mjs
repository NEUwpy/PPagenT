import {validateBlueprint as validateBase} from '../home-gray-mckinsey-20260920/visual-contract.mjs';
import {normalize} from '../home-gray-magazine-20260919/visual-contract.mjs';
export function validateBlueprint(gray,bp) {
  const issues=validateBase(gray,bp),groups=gray.pages[0].groups;
  const v=bp.visual;
  if(!v||![24,32,40].includes(v.groupGap)||typeof v.sectionDivider!=='boolean'||!Array.isArray(v.groups))return [...issues,'Missing supported visual settings'];
  if(v.groups.length!==groups.length || new Set(v.groups.map(g=>g.id)).size!==groups.length)issues.push('Each source group needs exactly one visual binding');
  for(const s of v.groups){
    const g=groups.find(g=>g.id===s.id);
    if(!g||!['small','large','rail'].includes(s.index)||!['plain','wash'].includes(s.heading)||!['natural','distributed'].includes(s.rhythm))issues.push('Unsupported group visual setting');
    if(s.index==='rail'&&g?.blocks.some(b=>b.kind&&b.kind!=='text'))issues.push('Index rail is for text lists; do not route it across a diagram');
  }
  if(!Array.isArray(bp.detailStrips))return [...issues,'detailStrips must be an array'];
  const seen=new Set();
  for(const s of bp.detailStrips){
    const block=groups.find(g=>g.id===s.groupId)?.blocks.find(b=>b.id===s.blockId);
    if(!block||block.kind==='diagram'||seen.has(s.blockId)){issues.push('Detail strip needs one unique text block');continue;}
    seen.add(s.blockId);
    if(!Array.isArray(s.parts)||s.parts.length<2||s.parts.length>6){issues.push('Strip supports 2–6 comparable short items');continue;}
    const parts=[s.intro,...s.parts.flatMap(p=>[p.label,p.body])];
    if(parts.some(p=>typeof p!=='string'||!p.trim())||normalize(parts.join(''))!==normalize(block.text))issues.push('Strip must preserve exact ordered source text. Concatenate intro + each(label + body) once: label and body must be adjacent NON-OVERLAPPING excerpts, never repeat a whole item in both fields.');
  }
  return issues;
}
