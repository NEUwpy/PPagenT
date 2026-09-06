import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {auditVisibleContract} from './audit-visible-contract.mjs';
const read=async p=>JSON.parse(await fs.readFile(new URL(p,import.meta.url),'utf8'));
const theme=await read('./inputs/theme.json');
test('real archived submission: unauthorized amber survives old zero-warning checks',async()=>{
  const r=auditVisibleContract(await read('./archive-a/round-01/slide-4.layout.json'),theme);
  assert(r.colorIssues.some(c=>c.color==='#8A5A16'));assert(r.colorIssues.some(c=>c.color==='#FBF4E6'));
});
test('real product submission: bars cover a heading despite disjoint text frames',async()=>{
  const r=auditVisibleContract(await read('./product-a/round-01/slide-4.layout.json'),theme);
  assert(r.paintIssues.some(p=>p.textPreview.includes('持续可用')));
});
test('a preceding rectangular semantic background is allowed',()=>{
  const r=auditVisibleContract({elements:[{id:'b',name:'background',kind:'shape',bbox:[0,0,200,100],fillColor:'#315F91',order:1},{id:'t',name:'body',kind:'shape',bbox:[16,16,168,68],text:'判断',resolvedTextStyle:{color:'#FFFFFF'},order:2}]},theme);
  assert.equal(r.paintIssueCount,0);assert.equal(r.colorIssueCount,0);
});
