import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function auditWrapTails(layout){
  const findings=[];
  for(const e of layout.elements??[]){
    const lines=e.textLayout?.lines??[],hardLines=(e.text??'').split(/\r?\n/).map(s=>s.trim());
    for(let i=1;i<lines.length;i++){
      const value=lines[i].text?.trim();if(!value||hardLines.includes(value))continue;
      const meaningful=value.replace(/[\s\p{P}\p{S}]/gu,'');
      if(meaningful.length<=1)findings.push({name:e.name,line:i+1,text:value,previousLine:lines[i-1].text,
        issue:meaningful.length===0?'SOFT_WRAP_PUNCTUATION_ONLY':'SOFT_WRAP_SINGLE_CHARACTER_TAIL'});
    }
  }
  return {count:findings.length,findings,scope:'Exported text lines; excludes author-declared hard lines. One-character tails are review candidates, not a language proof.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const results=[];for(const p of process.argv.slice(2))results.push({path:p,...auditWrapTails(JSON.parse(await fs.readFile(p,'utf8')))});console.log(JSON.stringify(results,null,2));}
