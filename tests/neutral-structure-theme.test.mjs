import test from 'node:test';
import {neutralPaint} from '../src/visual-runtime/neutral-structure-theme.mjs';
import assert from 'node:assert/strict';
import { compileHtmlComponentTheme } from '../src/visual-runtime/html-component-theme.mjs';
import { neutralEditorialTheme as theme } from '../src/runtime/skins/neutral-editorial-theme.mjs';
import { neutralStructureProfiles, supportsNeutralStructure } from '../src/visual-runtime/neutral-structure-profiles.mjs';
import { derivePrimaryTheme } from '../src/runtime/skins/primary-tone-palette.mjs';

test('wide track paint retains the halo, pale band and fine-line hierarchy and alpha', () => {
  const markup='<section class="cycle-racetrack-review" data-ppt-root></section>';
  const css='.cycle-track-halo{stroke:#fff;stroke-width:38}.cycle-track-band{stroke:#e3ebf5;stroke-width:25}.cycle-track-line{stroke:#789bc7;stroke-width:3;stroke-dasharray:8 8}.detail{stroke:rgba(91,129,168,.34);opacity:.6}';
  const result=compileHtmlComponentTheme({markup,css,theme}).css;
  assert.ok(result.includes(`stroke:${theme.background};stroke-width:38`));
  assert.ok(result.includes(`stroke:${neutralPaint('#e3ebf5','stroke',theme)};stroke-width:25`));
  assert.ok(result.includes(`stroke:${neutralPaint('#789bc7','stroke',theme)};stroke-width:3;stroke-dasharray:8 8`));
  assert.match(result,/rgba\([^)]*,\.34\);opacity:\.6/);
});

test('approved warm palette derives every paint role from one main tone', () => {
  const a = derivePrimaryTheme({primaryColor:'#000000',body:'#FFFFFF'}, '#F5F4EF');
  const b = derivePrimaryTheme({primaryColor:'#FFFFFF',body:'#000000'}, '#F5F4EF');
  assert.deepEqual(a,b);
  assert.equal(a.primaryColor,'#A35D4F');
  assert.equal(a.surface,'#EEECE4');
  const changed = derivePrimaryTheme({}, '#E5EEE8');
  for (const key of ['background','surface','line','muted','dark','body','primaryColor']) {
    assert.notEqual(changed[key],a[key],key);
    assert.match(changed[key],/^#[0-9A-F]{6}$/);
  }
});

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
  assert.ok(result.css.includes(`stroke:${neutralPaint('#315f91','stroke',theme)}`));
  assert.ok(!result.css.includes('color:#fff'));
});

test('adaptation scope is the existing 35 approved structures, not pending candidates', () => {
  assert.equal(neutralStructureProfiles.length,35);
  assert.equal(supportsNeutralStructure('<section class="rev rev-risk" data-ppt-root>'),false);
  const markup='<section class="rev rev-risk" data-ppt-root></section>';
  const css='.rev-risk{background:#315f91;color:#fff}';
  assert.deepEqual(compileHtmlComponentTheme({markup,css,theme}),compileHtmlComponentTheme({markup,css,theme:{...theme,id:'unregistered'}}));
});


test('one transfer retains six source levels and separates white cards from the canvas',()=>{
 const source=['#abc8da','#8bb2ca','#699abb','#4d80a7','#35688f','#28557a'];
 const fills=source.map(c=>neutralPaint(c,'surface',theme));
 assert.equal(new Set(fills).size,6);
 const brightness=c=>[1,3,5].reduce((sum,i)=>sum+parseInt(c.slice(i,i+2),16),0);
 assert.ok(fills.every((c,i)=>!i||brightness(c)<brightness(fills[i-1])));
 assert.deepEqual(source.map(c=>neutralPaint(c,'stroke',theme)),fills);
 assert.notEqual(neutralPaint('#FFFFFF','surface',theme),theme.background);
 assert.equal(neutralPaint('#FFFFFF','canvas',theme),theme.background);
 assert.equal(neutralPaint('#35688F80','surface',theme),fills[4]+'80');
 const result=compileHtmlComponentTheme({markup:'<section class="rev rev-iceberg" data-ppt-root></section>',css:'/* canvas */ .rev-iceberg{background:#fff}.card{background:#fff}',theme});
 assert.ok(result.css.includes(`.rev-iceberg{background:${theme.background}}`));
 assert.ok(result.css.includes(`.card{background:${neutralPaint('#fff','surface',theme)}}`));
});

test('pilots and ordinary structures use identical mapping for identical source paints',()=>{
 const classes=['simple-funnel simple-funnel-adapted','funnel-review','hub-review'];
 const results=classes.map(cls=>compileHtmlComponentTheme({markup:`<section class="${cls}" data-ppt-root><path fill="#2F5EA8" stroke="#8BB9E0"/></section>`,css:'.sample{fill:var(--ppagent-color-primary,#2F5EA8)}',theme}));
 const paths=results.map(r=>r.markup.match(/<path[^>]*>/)[0]);
 assert.ok(paths.every(p=>p===paths[0]));
 assert.ok(results.every(r=>r.css.includes(`fill:${neutralPaint('#2F5EA8','surface',theme)}`)));
});
