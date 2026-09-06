import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const outcomes=JSON.parse((await fs.readFile(path.join(base,'review-outcomes.json'),'utf8')).replace(/^\uFEFF/,''));
const selections=JSON.parse(await fs.readFile(path.join(base,'selected-deliverables.json'),'utf8'));
const runs=[];
for(const selection of selections){
  const rounds=[];
  for(const item of selection.history){
    const o=outcomes.runs.find(r=>r.run===item.run);
    if(!o)throw new Error(`Missing parent outcome: ${item.run}`);
    const review=`reviews/${item.run.replace('/','-')}`;
    const v=JSON.parse(await fs.readFile(path.join(base,review,'verification.json'),'utf8'));
    if(v.pageCount!==o.pages||v.renderExitCode!==0||v.canvasTestExitCode!==0)throw new Error(`Invalid verification: ${item.run}`);
    const pageNotes=selection.pageNotes?.[item.run]??[];
    const status=o.wholeDeckAccepted?'整稿经父任务逐页复核通过':'整稿退回，不作为精选交付';
    const pages=v.renders.map(r=>({image:r.path,review:pageNotes[r.page-1]??`${status}。第 ${r.page} 页：${o.accepted.includes(r.page)?'本页可交付':'本页未通过'}。${o.independentFirst?'这是无逐页反馈的独立首轮。':'这是接收文字反馈后的修订，不能算首轮成功。'}`}));
    for(const p of pages)await fs.access(path.join(base,p.image));
    rounds.push({label:item.label,deck:item.run===selection.run?selection.file:`${item.run}/deck.pptx`,verification:`${review}/verification.json`,pages});
  }
  runs.push({title:selection.title,rounds});
}
const first=outcomes.runs.filter(r=>r.independentFirst);
await fs.writeFile(path.join(base,'review-manifest.json'),JSON.stringify({summary:`三篇完整稿件，默认显示父任务逐页复核后的精选版本。已复核 ${first.length} 次独立首轮，其中 ${first.filter(r=>r.wholeDeckAccepted).length} 次整稿通过。不同提示版本分开统计，不能宣称已达到无人审稿的稳定性。`,runs},null,2)+'\n');
console.log(`Prepared ${runs.length} manuscript galleries`);
