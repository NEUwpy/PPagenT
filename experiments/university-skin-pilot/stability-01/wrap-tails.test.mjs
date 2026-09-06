import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {auditWrapTails} from './audit-wrap-tails.mjs';
test('real product revision exposes isolated punctuation and final character',async()=>{
  const p=JSON.parse(await fs.readFile(new URL('./product-a/round-02/slide-2.layout.json',import.meta.url),'utf8'));
  const r=auditWrapTails(p);assert(r.findings.some(f=>f.text==='。'));assert(r.findings.some(f=>f.text==='险。'));
});
test('intentional hard-line short labels are not flagged',()=>{
  assert.equal(auditWrapTails({elements:[{text:'甲\n乙',textLayout:{lines:[{text:'甲'},{text:'乙'}]}}]}).count,0);
});
