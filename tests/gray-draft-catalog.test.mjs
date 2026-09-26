import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {collectGrayDrafts,resolveGrayDraftFile} from '../src/tools/gray-draft-catalog.mjs';

async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ppa-gray-catalog-'));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('ppa-gray-catalog-'));await fs.rm(root,{recursive:true,force:true});});
  await fs.mkdir(path.join(root,'catalog'));
  await fs.mkdir(path.join(root,'run/revision-2/artifacts/preview'),{recursive:true});
  await fs.writeFile(path.join(root,'catalog/gray-drafts.json'),JSON.stringify({schemaVersion:'ppa-gray-draft-catalog-1',drafts:[{id:'sample',title:'样例',statePath:'run/state.json'}]}));
  await fs.writeFile(path.join(root,'run/state.json'),JSON.stringify({pages:[{pageId:'p1',title:'页面一',claim:'模拟内容'}],grayDraft:{humanReview:'pending',artifactDirectory:'run/revision-2/artifacts'}}));
  await fs.writeFile(path.join(root,'run/gray-draft.pptx'),'stale deck');
  await fs.writeFile(path.join(root,'run/revision-2/artifacts/gray-draft.pptx'),'current deck');
  await fs.writeFile(path.join(root,'run/revision-2/artifacts/preview/slide-01.png'),'current png');
  await fs.writeFile(path.join(root,'run/revision-2/artifacts/preview-index.json'),JSON.stringify([{pageId:'p1',preview:'preview/slide-01.png'}]));
  return root;
}

test('读取状态指向的当前 revision，保留待验收而非自动批准',async t=>{
  const root=await fixture(t);
  const [draft]=await collectGrayDrafts(root);
  assert.equal(draft.pageCount,1);assert.equal(draft.available,true);assert.equal(draft.humanReview,'pending');
  assert.equal(draft.structureApplied,false);assert.equal(draft.files.content,null);
  assert.match(draft.pages[0].previewUrl,/page=1&v=/);
  const deck=await resolveGrayDraftFile(root,{id:'sample',kind:'pptx'});
  assert.equal(await fs.readFile(deck.filePath,'utf8'),'current deck');
});
test('未知 ID、文件类型、越界页和路径输入不能选取文件',async t=>{
  const root=await fixture(t);
  for(const request of [{id:'../sample',kind:'pptx'},{id:'sample',kind:'../state'},{id:'sample',kind:'preview',page:'../state.json'},...['0','2','1.5','1e0',''].map(page=>({id:'sample',kind:'preview',page}))])assert.equal(await resolveGrayDraftFile(root,request),null);
});
test('快照缺失时保持缺失，不回退旧 PPT 或生成新快照',async t=>{
  const root=await fixture(t);
  await fs.unlink(path.join(root,'run/revision-2/artifacts/preview/slide-01.png'));
  await fs.unlink(path.join(root,'run/revision-2/artifacts/gray-draft.pptx'));
  const [draft]=await collectGrayDrafts(root);
  assert.equal(draft.pages[0].previewUrl,null);assert.equal(draft.files.pptx,null);
  assert.equal(await resolveGrayDraftFile(root,{id:'sample',kind:'pptx'}),null);
});
test('越出项目的产物指针被拒绝',async t=>{
  const root=await fixture(t);
  const state=JSON.parse(await fs.readFile(path.join(root,'run/state.json'),'utf8'));
  state.grayDraft.artifactDirectory='../outside';
  await fs.writeFile(path.join(root,'run/state.json'),JSON.stringify(state));
  const [draft]=await collectGrayDrafts(root);
  assert.equal(draft.available,false);assert.match(draft.error,/项目内/);
  await assert.rejects(resolveGrayDraftFile(root,{id:'sample',kind:'pptx'}),/项目内/);
});
