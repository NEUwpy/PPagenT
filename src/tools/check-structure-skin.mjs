import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const option=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const base=option('--base','http://127.0.0.1:4192'),skin=option('--skin','neutral');
const data=await fetch(base+'/api/dashboard-data').then(r=>{if(!r.ok)throw new Error('看板不可用');return r.json();});
if(!data.structureSkins.some(s=>s.id===skin))throw new Error('Skin 尚未登记');
if(!/^[a-z][a-z0-9-]*$/.test(skin))throw new Error('Skin id 非法');
const out=path.resolve(option('--out',`experiments/skin-onboarding-${skin}`));await fs.mkdir(out,{recursive:true});
const ids=['parallel-folded-notes-grid-002','convergence-simple-funnel-001','convergence-many-to-one-003','layered-iceberg-depth-006','cycle-loop-001'];
const browser=await chromium.launch({executablePath:option('--browser','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'),headless:true});
const page=await browser.newPage({viewport:{width:1170,height:492}});const report=[];
try {
 for(const id of ids){
  const response=await page.goto(`${base}/api/component-preview?library=core&id=${id}&skin=${skin}`);
  await page.evaluate(()=>document.fonts.ready);
  const roots=await page.locator('[data-ppt-root]').count();
  const clipped=await page.locator('[data-slot-content-type="text"],[data-text-flow-part]').evaluateAll(es=>es.filter(e=>/hidden|clip/.test(getComputedStyle(e).overflow)&&(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2)).map(e=>e.textContent));
  await page.screenshot({path:path.join(out,id+'.png')});report.push({id,status:response.status(),roots,clipped});
 }
}finally{await browser.close();}
const passed=report.every(r=>r.status===200&&r.roots===1&&!r.clipped.length);
await fs.writeFile(path.join(out,'report.json'),JSON.stringify({skin,technicalChecks:passed?'passed':'failed',visualApproval:'pending',report},null,2));
await fs.writeFile(path.join(out,'index.html'),'<meta charset="utf-8"><style>body{font:18px sans-serif;margin:24px}img{max-width:100%}</style><h1>Skin 接入 · '+skin+'</h1><p>技术检查'+(passed?'通过':'失败')+'；审美待人工确认。本检查不自动晋升状态。</p>'+ids.map(id=>'<h2>'+id+'</h2><img src="'+id+'.png">').join(''));
console.log(out,passed?'技术检查通过，视觉待确认':'检查失败');if(!passed)process.exitCode=1;
