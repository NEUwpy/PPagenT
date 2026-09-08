import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('./',import.meta.url);
const base=process.env.DASHBOARD_URL??'http://127.0.0.1:4203';
const ids=['layered-iceberg-depth-006','convergence-simple-funnel-001','convergence-funnel-001','convergence-many-to-one-003','hub-directed-outcomes-002','cycle-loop-001'];
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1170,height:492}});
const report={};
try{
  for(const id of ids){
    const response=await page.goto(`${base}/api/component-preview?library=core&id=${id}&skin=neutral`);
    assert.equal(response.status(),200);
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:new URL(id+'.png',out).pathname.replace(/^\/(\w:)/,'$1')});
    report[id]=await page.locator('[data-ppt-root]').evaluate(root=>({roots:document.querySelectorAll('[data-ppt-root]').length,paints:[...root.querySelectorAll('path,ellipse,polygon')].map(e=>({name:e.dataset.pptName,cls:e.getAttribute('class'),fill:getComputedStyle(e).fill,stroke:getComputedStyle(e).stroke,width:getComputedStyle(e).strokeWidth}))}));
    assert.equal(report[id].roots,1);
  }
  const simple=report[ids[1]].paints,complex=report[ids[2]].paints;
  for(const part of ['body','cap']){
    const a=simple.find(e=>e.cls?.includes('step-'+part)),b=complex.find(e=>e.cls?.includes('step-'+part));
    assert.ok(a&&b,part);
    for(const role of ['fill','stroke','width'])assert.equal(a[role],b[role],part+' '+role);
  }
  for(const skin of ['neutral','university'])for(const count of [3,4,6]){
    await page.goto(`${base}/api/component-preview?library=core&id=cycle-loop-001&skin=${skin}&stepCount=${count}`);
    const paints=await page.locator('[data-ppt-name^="cycle-band-"],[data-ppt-name^="cycle-arrow-"]').evaluateAll(es=>es.map(e=>({name:e.dataset.pptName,fill:getComputedStyle(e).fill,stroke:getComputedStyle(e).stroke})));
    for(let i=0;i<count;i++){
      const band=paints.find(e=>e.name==='cycle-band-'+i),arrow=paints.find(e=>e.name==='cycle-arrow-'+i);
      assert.ok(band&&arrow);assert.equal(band.fill,arrow.fill);assert.equal(band.stroke,'none');assert.equal(arrow.stroke,'none');
    }
    await page.screenshot({path:`experiments/cycle-stage-palette/${skin}-${count}.png`});
    report[`${skin}-${count}`]=paints;
  }
  await fs.writeFile(new URL('checks.json',out),JSON.stringify(report,null,2));
  await fs.writeFile(new URL('index.html',out),'<meta charset="utf-8"><style>body{background:#f5f4ef;font:18px sans-serif;margin:24px}img{width:100%;max-width:1170px;display:block}</style><h1>中性结构 · 对应形状共用派生颜色</h1><p>漏斗主体、顶面、轮廓一致；冰山保留分面；关系线使用中等色阶；循环箭头与环段无分隔描边。</p>'+ids.map(id=>'<h2>'+id+'</h2><img src="'+id+'.png">').join(''));
  console.log('PASS: 6 previews, funnel computed colors, 6 cycle configurations');
}finally{await browser.close();}
