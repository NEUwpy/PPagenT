import fs from 'node:fs/promises';
import path from 'node:path';
const dir=import.meta.dirname;
const short=JSON.parse(await fs.readFile(path.join(dir,'../structure-remaining-page-luna/luna/P1/P1-attempt-1.json'),'utf8')).spec.content;
const normal=JSON.parse(await fs.readFile(path.join(dir,'../structure-remaining-page-luna/revisions/P1-normal/manuscript.json'),'utf8')).spec.content;
for(const content of [short,normal])content.items.forEach(i=>i.body=i.body.replace(/\n/g,''));
// The claim and its explanation form two semantic lines in the wider page layout.
normal.items.forEach(i=>i.body=i.body.replace('，','，\n'));
// These page regions express peer relations and density, with no structure asset coordinates.
const plans=[
 {id:'short',title:'交接验收的四项条件',content:short,
 frame:{left:490,top:200,width:700,height:386},itemRegions:[{left:0,top:0,width:330,height:166},{left:370,top:0,width:330,height:166},{left:0,top:220,width:330,height:166},{left:370,top:220,width:330,height:166}],
 blocks:[{role:'module',text:'接手者能独立继续工作',frame:{left:56,top:235,width:380,height:46}},{role:'body',text:'以工作能否接续，判断交接是否完成。\n发送文件只是交接动作。',frame:{left:56,top:299,width:365,height:90}}],
 intention:'短稿：左侧主张占三分之一，右侧四项等权条件占三分之二。页面从左侧主张读向右侧条件，四项不表达顺序。'},
 {id:'normal',title:'交接验收：从文件交付到工作接续',content:normal,
 frame:{left:56,top:240,width:1168,height:370},itemRegions:[{left:0,top:0,width:554,height:166},{left:614,top:0,width:554,height:166},{left:0,top:204,width:554,height:166},{left:614,top:204,width:554,height:166}],
 blocks:[{role:'module',text:'接手者能独立继续工作，才算交接完成',frame:{left:56,top:135,width:700,height:44}},{role:'body',text:'发送文件只是交接动作，验收还要核对以下四项。',frame:{left:56,top:184,width:720,height:38}}],
 intention:'常规稿：上方主张引领两列两行解释；内容区域横向利用正文宽度，按信息量确定行高，保持同级项目一致。'}
];
await fs.writeFile(path.join(dir,'layout-plan.json'),JSON.stringify({decisionOrder:['稿件关系与主张','页面区域与文字层级','普通色块表达','在相同区域应用折角便签设计','实际PPT复核'],plans},null,2));
console.log('Saved layout-first plan before rendering either appearance');
