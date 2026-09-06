import assert from "node:assert/strict";
import test from "node:test";

import { northeasternUniversityTheme } from "../src/runtime/skins/northeastern-university-theme.mjs";
import {
  compileHtmlComponentTheme,
  compileStructureThemeSource,
  defaultStructurePrimaryColor,
  htmlComponentThemeCss,
  resolveStructureTheme,
} from "../src/visual-runtime/html-component-theme.mjs";

test("东北大学 Theme 引用共享默认主色常量", () => {
  assert.equal(northeasternUniversityTheme.primaryColor, defaultStructurePrimaryColor);
});

test("单一 primaryColor 推导离散结构色阶并压过旧 secondary tokens", () => {
  const theme = resolveStructureTheme({
    primaryColor: "#6F42C1",
    accent: "#FF0000",
    accentAlt: "#00FFFF",
    accentSoft: "#FFFF00",
    cyan: "#00FF00",
    body: "#FF00FF",
  });
  assert.equal(theme.primaryColor, "#6F42C1");
  assert.equal(theme.accent, "#6F42C1");
  assert.notEqual(theme.accentAlt, "#00FFFF");
  assert.notEqual(theme.accentSoft, "#FFFF00");
  assert.notEqual(theme.cyan, "#00FF00");
  assert.equal(theme.body, "#404040");
  assert.match(theme.primaryDeep, /^#[0-9A-F]{6}$/);
  assert.match(theme.primaryWash, /^#[0-9A-F]{6}$/);
});

test("历史彩色字面量进入共享角色，中性色与透明度保持", () => {
  const theme = { primaryColor: defaultStructurePrimaryColor };
  const compiled = compileStructureThemeSource(
    ".x{color:#E97132;background:#EEEEEE;border:#28577D;box-shadow:0 0 3px rgba(15,158,213,.35)}",
    theme,
  );
  const palette = resolveStructureTheme(theme);
  assert.match(compiled, new RegExp(palette.primaryColor, "i"));
  assert.match(compiled, new RegExp(palette.primaryDark, "i"));
  assert.match(compiled, /#EEEEEE/i);
  assert.match(compiled, /rgba\([^)]*,\.35\)/);
  assert.doesNotMatch(compiled, /E97132|28577D|15\s*,\s*158\s*,\s*213/i);
});

test("未声明 primaryColor 的旧调用保持历史组件颜色", () => {
  const source = ".x{color:#E97132;background:#DCE9FA}";
  assert.equal(compileStructureThemeSource(source, { accent: "#123456" }), source);
});

test("markup 只转换样式与颜色属性，不改正文、引用、选择器、data 或脚本", () => {
  const theme = { primaryColor: "#6F42C1" };
  const markup = `<div id="E97132" data-code="#E97132" style="color:#E97132;background:url(#E97132)">稿件原文：色号 #E97132</div>
    <svg><defs><linearGradient id="E97132"></linearGradient></defs><path href="#E97132" fill="#E97132" stroke="url(#E97132)"></path></svg>
    <style>#E97132{color:#E97132;background-image:url("#E97132")}</style>
    <script>const sample = 'fill="#E97132"';</script>`;
  const compiled = compileHtmlComponentTheme({ markup, theme }).markup;
  const primary = resolveStructureTheme(theme).primaryColor;
  assert.match(compiled, /id="E97132"/);
  assert.match(compiled, /data-code="#E97132"/);
  assert.match(compiled, /稿件原文：色号 #E97132/);
  assert.match(compiled, /href="#E97132"/);
  assert.match(compiled, /stroke="url\(#E97132\)"/);
  assert.match(compiled, /<style>#E97132\{color:/);
  assert.match(compiled, /background-image:url\("#E97132"\)/);
  assert.match(compiled, /<script>const sample = 'fill="#E97132"';<\/script>/);
  assert.match(compiled, new RegExp(`style="color:${primary}`));
  assert.match(compiled, new RegExp(`fill="${primary}"`));
});

test("主题 CSS 不二次映射，十六进制和 rgba alpha 原样保留", () => {
  const theme = { primaryColor: "#6F42C1" };
  const resolvedCss = htmlComponentThemeCss(theme);
  assert.equal(compileStructureThemeSource(resolvedCss, theme), resolvedCss);
  const compiled = compileStructureThemeSource(".x{color:#E971327F;background:rgba(15,158,213,.35)}", theme);
  assert.match(compiled, /#[0-9A-F]{6}7F/);
  assert.match(compiled, /rgba\([^)]*,\.35\)/);
});

test("标签属性扫描不会把 data 属性值中的伪颜色属性误改", () => {
  const theme = { primaryColor: "#6F42C1" };
  const markup = `<div data-example="sample fill='#E97132'" fill="#E97132">原文</div>`;
  const compiled = compileHtmlComponentTheme({ markup, theme }).markup;
  assert.match(compiled, /data-example="sample fill='#E97132'"/);
  assert.match(compiled, new RegExp(` fill="${resolveStructureTheme(theme).primaryColor}"`));
});

test("CSS 前置和间隔注释保持原文，注释后的真实声明继续换色", () => {
  const theme = { primaryColor: "#6F42C1" };
  const css = `.a{/* first declaration */color:#E97132; stroke:#E97132; /* note #E97132 */ fill:#E97132}`;
  const compiled = compileStructureThemeSource(css, theme);
  assert.match(compiled, /\/\* first declaration \*\//);
  assert.match(compiled, /\/\* note #E97132 \*\//);
  assert.doesNotMatch(compiled, /(?:color|stroke|fill):#E97132/);
  assert.equal((compiled.match(/#6F42C1/g) ?? []).length, 3);
});

test("CSS 声明值内部注释不换色，注释后的实际颜色继续换色", () => {
  const theme = { primaryColor: "#6F42C1" };
  const css = `.a{color:/* note #E97132 */#E97132}`;
  const compiled = compileStructureThemeSource(css, theme);
  assert.equal(compiled, `.a{color:/* note #E97132 */#6F42C1}`);
});
