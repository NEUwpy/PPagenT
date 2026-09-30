import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory=path.dirname(fileURLToPath(import.meta.url));
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const files=['mapped-geometry.json','plan.json','preview/slide-01.png','preview/slide-02.png'];
const rows=[];
for(const file of files){
 const hashes=await Promise.all(['run-01','run-02','run-03'].map(run=>fs.readFile(path.join(directory,run,file)).then(sha)));
 rows.push({file,hashes,equal:new Set(hashes).size===1});
}
assert(rows.every(r=>r.equal),JSON.stringify(rows));
const result={scope:'三次人工固定计划、脚本选择/审稿回执，同一代码环境；比较计划、实际测量和导出PPTX重导入PNG，不证明模型重复判断，不要求PPTX二进制相同。',rows};
await fs.writeFile(path.join(directory,'replay-verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
