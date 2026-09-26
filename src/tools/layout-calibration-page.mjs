import fs from 'node:fs/promises';
import path from 'node:path';
import {composeContentCalibration} from '../visual-runtime/content-layout-calibration.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function calibrationPage(root,url) {
  const sample=url.searchParams.get('sample')==='safety'?'safety':'procurement';
  const mapping=JSON.parse(await fs.readFile(path.join(root,'catalog/layout-calibration-'+sample+'.json'),'utf8'));
  const source=await fs.readFile(path.join(root,mapping.sourcePath),'utf8');
  const family=url.searchParams.get('family')??'cards',direction=url.searchParams.get('direction')??'horizontal';
  let result, error;
  try {result=composeContentCalibration(source,mapping,{family,direction});} catch(e){error=e.message;}
  const stage=result ? `<div class="stage" aria-label="真实内容布局预览"><h2>${esc(result.title)}</h2><div class="canvas">${result.regions.map(r=>`<section class="region ${r.role}" style="left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px"><div>${esc(r.text)}</div></section>`).join('')}</div></div>` : `<p role="alert">${esc(error)}</p>`;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>单页内容布局校准</title><style>
  *{box-sizing:border-box}body{font-family:'Microsoft YaHei',sans-serif;margin:0;padding:20px;color:#263343;background:#f6f8fb}p{line-height:1.7}button,a{display:inline-block;padding:8px 14px;margin:4px;border:1px solid #ccd6e2;border-radius:6px;background:white;color:#23496c}a.active{background:#23496c;color:white}.viewport{overflow:auto;background:white;border:1px solid #dce3eb;border-radius:12px}.stage{width:1218px;padding:24px}h2{font-size:28px;margin:0 0 24px}.canvas{width:1170px;height:492px;position:relative}.region{position:absolute;padding:16px;background:#e9eef4;border-top:3px solid #91a4b8;font-size:22px;line-height:1.35;white-space:pre-wrap;overflow:visible;overflow-wrap:anywhere}.region.object{display:flex;align-items:center}.region.object>div{border-left:3px solid #91a4b8;padding-left:14px}.shared{background:#f0f3f6;border-top:1px solid #c2cdd8}table{width:100%;border-collapse:collapse;background:white}td,th{padding:10px;border:1px solid #d8e0e9;text-align:left;vertical-align:top}pre{white-space:pre-wrap}summary{cursor:pointer;padding:12px}small{color:#58687a}</style>
  <h2>真实单页内容 → 布局块 → 规则试排</h2><p><strong>人工映射校准</strong>：这里验证布局如何承载真实内容，尚未自动识别或自动选型。原稿全文逐字引用，主体、应急条款和共同要求均使用 22px 正文字号。</p>
  <nav><a href="?sample=procurement">采购规定 · 同组拆块＋共同说明</a><a href="?sample=safety">安全通报 · 不同体量与局部限定</a></nav><nav>${[['cards','horizontal','横向卡片'],['cards','vertical','纵向卡片'],['album','horizontal','相册分区']].map(([f,d,n])=>`<a class="${f===family&&d===direction?'active':''}" href="?sample=${sample}&family=${f}&direction=${d}">${n}</a>`).join('')}</nav>
  <p>内容区 1170 × 492；共同说明独立占带，主体区域调用同一套卡片／相册分区规则。放不下会明确报错，不能缩字隐藏。</p><div class="viewport">${stage}</div>
  <details><summary>原稿与分块依据（全部内容均可追溯）</summary><pre>${esc(source)}</pre><table><tr><th>视觉块</th><th>语义组／作用对象</th><th>来源内容 ID</th><th>分块依据</th></tr>${mapping.blocks.map(b=>`<tr><td>${esc(b.id)} · ${esc(b.role)}</td><td>${esc(b.semanticGroup??b.scopeIds?.join('、')??'页面标题')}</td><td>${esc(b.unitIds.join('、'))}</td><td>${esc(b.reason)}</td></tr>`).join('')}</table></details>
  <details><summary>测量与映射回执</summary><pre>${esc(JSON.stringify(result??{error},null,2))}</pre></details><script>const stage=document.querySelector(".stage"),viewport=document.querySelector(".viewport");if(stage){const resize=()=>{stage.style.zoom=Math.min(1,viewport.clientWidth/1218)};new ResizeObserver(resize).observe(viewport);resize();}</script></html>`;
}
