import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHARED_RULES, SEMANTIC_CONTRACT } from '../src/runner/gray-semantics.mjs';
import { GRAY_AGENT_PROMPT } from '../src/runner/gray-agent.mjs';

const occurrences = (haystack, needle) => haystack.split(needle).length - 1;

test('提示词去重：共享片段在源码中恰好出现一次（单一来源），两份提示词均由它拼装', () => {
  const semSource = fs.readFileSync('src/runner/gray-semantics.mjs', 'utf8');
  const agentSource = fs.readFileSync('src/runner/gray-agent.mjs', 'utf8');
  for (const [key, fragment] of Object.entries(SHARED_RULES)) {
    assert.ok(fragment.length >= 20, `共享片段 ${key} 过短`);
    const total = occurrences(semSource, fragment) + occurrences(agentSource, fragment);
    assert.equal(total, 1, `共享片段 ${key} 应在源码中恰好出现一次（当前 ${total}）`);
    assert.ok(GRAY_AGENT_PROMPT.includes(fragment), `GRAY_AGENT_PROMPT 缺少共享片段 ${key}`);
    assert.ok(SEMANTIC_CONTRACT.includes(fragment), `SEMANTIC_CONTRACT 缺少共享片段 ${key}`);
  }
});

test('关键条款在两份提示词同时存在（同步测试替代人工注释纪律）', () => {
  const clauses = ['附着性内容', '模拟/假设声明', '行式表格只用于', 'label', '类别成为组', '页数服从内容量', '不得上屏'];
  for (const clause of clauses) {
    assert.ok(GRAY_AGENT_PROMPT.includes(clause), `GRAY_AGENT_PROMPT 缺少：${clause}`);
    assert.ok(SEMANTIC_CONTRACT.includes(clause), `SEMANTIC_CONTRACT 缺少：${clause}`);
  }
});
