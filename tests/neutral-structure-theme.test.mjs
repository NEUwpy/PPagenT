import test from 'node:test';
import assert from 'node:assert/strict';
import { compileHtmlComponentTheme } from '../src/visual-runtime/html-component-theme.mjs';
import { neutralEditorialTheme as theme } from '../src/runtime/skins/neutral-editorial-theme.mjs';
import { neutralStructureProfiles, supportsNeutralStructure } from '../src/visual-runtime/neutral-structure-profiles.mjs';

test('neutral paint adaptation preserves geometry, content and media while keeping readable text', () => {
  const markup = '<section class="hub-review" data-ppt-root><svg><path d="M 10 20 L 30 40" fill="#315f91" stroke="#315f91"/><text x="12" y="34" fill="#fff">#315f91 原文</text></svg><img src="photo-315f91.png"></section>';
  const css = '.hub-review{width:1170px;height:492px;background:#315f91;color:#fff}.title{color:var(--ppagent-color-background,#fff);font-size:18pt}.line{stroke:var(--ppagent-color-accent,#315f91)}';
  const result = compileHtmlComponentTheme({markup,css,theme});
  assert.ok(result.markup.includes('d="M 10 20 L 30 40"'));
  assert.ok(result.markup.includes('>#315f91 原文</text>'));
  assert.ok(result.markup.includes('src="photo-315f91.png"'));
  assert.ok(result.markup.includes(`fill="${theme.dark}"`));
  assert.ok(result.css.includes('width:1170px;height:492px'));
  assert.ok(result.css.includes('font-size:18pt'));
  assert.ok(result.css.includes(`stroke:${theme.muted}`));
  assert.ok(!result.css.includes('color:#fff'));
});

test('adaptation scope is the existing 35 approved structures, not pending candidates', () => {
  assert.equal(neutralStructureProfiles.length,35);
  assert.equal(supportsNeutralStructure('<section class="rev rev-risk" data-ppt-root>'),false);
  const markup='<section class="rev rev-risk" data-ppt-root></section>';
  const css='.rev-risk{background:#315f91;color:#fff}';
  assert.deepEqual(compileHtmlComponentTheme({markup,css,theme}),compileHtmlComponentTheme({markup,css,theme:{...theme,id:'unregistered'}}));
});
