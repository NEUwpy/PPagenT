import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHtmlComponent, closeHtmlComponentRuntime } from '../src/visual-runtime/html-component-runtime.mjs';
import { sizeTypographyTheme, resizeDesignCss } from '../src/visual-runtime/preserved-size-component.mjs';
import { preservedTypography } from '../src/visual-runtime/preserved-design-layout.mjs';

test('local sizes adapt explicit Skin roles and custom font aliases without dropping below 12 pt', () => {
  const theme = sizeTypographyTheme({typography: {componentItemTitle:18,componentBody:14}});
  const type = preservedTypography(.58,theme);
  assert.equal(type.sizes.componentBody,12);
  assert.equal(type.sizes.componentItemTitle,12);
  assert.match(resizeDesignCss('.label{--title-size:15pt;width:200px}',.58,type),/--title-size:12pt;width:116px/);
});

test('SVG preview and native tree use the same visible font after viewBox scaling', async () => {
  const component = {id:'svg-local-font',designFrame:{width:200,height:100},cssText:'text{font:20px Arial}',
    renderMarkup:()=>'<section data-ppt-root data-ppt-fit-footprint="true" data-ppt-preserve-font="true" style="width:200px;height:100px"><svg width="200" height="100" viewBox="0 0 800 400"><text x="80" y="180" data-ppt-kind="text" data-ppt-name="label">Cycle</text></svg></section>'};
  try {
    const tree=await resolveHtmlComponent({component,parameters:{},assetDir:process.cwd(),includeDocument:true});
    assert.equal(tree.nodes.find(n=>n.name==='label').style.fontSize,16);
    assert.match(tree.resolvedDocument,/font-size: 64px/);
  } finally { await closeHtmlComponentRuntime(); }
});
