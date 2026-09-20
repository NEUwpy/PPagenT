import fs from 'node:fs/promises';
const base='http://127.0.0.1:4192';
const data=await (await fetch(`${base}/api/dashboard-data`)).json();
const records=data.records.filter(a=>a.structureSkill && a.status==='core');
const results=[];
for(const asset of records) {
  const query=new URLSearchParams({library:asset.library,id:asset.id,skin:'university',size:'small',...asset.componentInitialSelection});
  const response=await fetch(`${base}/api/component-preview?${query}`);
  const html=await response.text();
  const row={assetId:asset.id,status:response.status,measuredLayout:html.includes('data-ppt-resolved'),smallFrame:html.includes('data-preview-size="small"')};
  if(!response.ok)row.error=html;
  results.push(row);
  console.log(asset.id,response.status,row.measuredLayout);
}
await fs.writeFile(new URL('./dashboard-report.json',import.meta.url),JSON.stringify(results,null,2));
if(results.length!==35 || results.some(r=>r.status!==200 || !r.measuredLayout || !r.smallFrame))process.exitCode=1;
