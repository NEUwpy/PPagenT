import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {spawn} from 'node:child_process';
const output=path.resolve('outputs/gray-rules-report-20260916');
const html=await fs.readFile(path.join(output,'index.html'),'utf8');
const records=JSON.parse(await fs.readFile(path.join(output,'records.json'),'utf8'));
const nodes=new Map(),listeners={};
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:''});return nodes.get(id)};
const document={getElementById:node,addEventListener:(kind,fn)=>listeners[kind]=fn};
vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/u)[1],{document,console},{timeout:1000});
if(!node('left').innerHTML.includes('已导出 6 页')||!node('right').innerHTML.includes('已导出 8 页'))throw new Error('default comparison');
node('same-content').onclick();if(!node('right').innerHTML.includes('3 / 6'))throw new Error('same-content navigation');
listeners.click({target:{dataset:{side:'right',step:'1'}}});if(!node('right').innerHTML.includes('4 / 6'))throw new Error('next page');
listeners.change({target:{id:'case',value:'hierarchy',dataset:{}}});if(!node('left').innerHTML.includes('没有实际PPT'))throw new Error('failure panel');
listeners.change({target:{id:'case',value:'numbers-new',dataset:{}}});if(!node('left').innerHTML.includes('未导出'))throw new Error('holdout fallback');
for(const name of ['positive','guarded','focused','compact']){node('profile').value=name;listeners.change({target:{id:'profile',dataset:{}}});if(!node('prompt-diff').innerHTML.includes('基础排版'))throw new Error('prompt selector');}
const queue=records.filter(r=>r.pages),results=[];
for(const r of records){await fs.access(path.resolve(output,r.run,'state.json'));for(let n=1;n<=r.pages;n++)await fs.access(path.resolve(output,r.run,'preview',`slide-${String(n).padStart(2,'0')}.png`));}
console.log('Viewer interactions and all state/image paths verified');
const python='C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const script='C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.61513/skills/presentations/container_tools/slides_test.py';
const env={...process.env,RUNTIME_NODE:'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe',RUNTIME_NODE_MODULES:'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'};
async function worker(){for(let r;(r=queue.shift());){const dir=path.resolve(output,r.run),ppt=path.join(dir,'gray-draft.pptx');const checked=await new Promise(resolve=>{const child=spawn(python,[script,ppt],{env,windowsHide:true});let text='';child.stdout.on('data',d=>text+=d);child.stderr.on('data',d=>text+=d);child.on('error',e=>resolve({code:-1,text:e.message}));child.on('close',code=>resolve({code,text}));});await fs.writeFile(path.join(dir,'experiment-overflow-check.txt'),checked.text);results.push({batch:r.batch,profile:r.profile,case:r.case,...checked});console.log(`${r.profile} ${r.case}: ${checked.code}`);}}
await Promise.all([worker(),worker()]);await fs.writeFile(path.join(output,'validation.json'),JSON.stringify({viewer:'Script interactions and paths checked; not browser visual acceptance.',overflow:results},null,2));
