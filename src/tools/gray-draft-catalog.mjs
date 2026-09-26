import fs from 'node:fs/promises';
import path from 'node:path';

const inside=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&!rel.startsWith(`..${path.sep}`)&&rel!=='..'&&!path.isAbsolute(rel);};
async function safeFile(root,file) {
  const resolved=path.resolve(root,file);
  if(!inside(root,resolved))throw new Error('灰稿路径必须位于项目内');
  const actual=await fs.realpath(resolved);
  if(!inside(await fs.realpath(root),actual))throw new Error('灰稿链接目标必须位于项目内');
  return actual;
}
async function entries(root) {
  let registry;
  try{registry=JSON.parse(await fs.readFile(path.join(root,'catalog/gray-drafts.json'),'utf8'));}
  catch(e){if(e.code==='ENOENT')return [];throw e;}
  if(registry.schemaVersion!=='ppa-gray-draft-catalog-1'||!Array.isArray(registry.drafts))throw new Error('灰稿目录格式不正确');
  const seen=new Set();
  for(const item of registry.drafts){
    if(!/^[a-z0-9-]+$/.test(item.id)||seen.has(item.id)||typeof item.statePath!=='string')throw new Error('灰稿目录 ID 或状态路径不正确');
    seen.add(item.id);
  }
  return registry.drafts;
}
async function context(root,entry) {
  const statePath=await safeFile(root,entry.statePath);
  const state=JSON.parse(await fs.readFile(statePath,'utf8'));
  if(!state.grayDraft||!Array.isArray(state.pages))throw new Error('缺少灰稿状态或页面');
  // The run state selects the current revision. Never silently show a stale run-root deck.
  const directory=state.grayDraft.artifactDirectory
    ? path.resolve(root,state.grayDraft.artifactDirectory):path.dirname(statePath);
  if(!inside(root,directory))throw new Error('灰稿产物目录必须位于项目内');
  return {statePath,state,directory};
}
const fileNames={pptx:'gray-draft.pptx',content:'content.md'};
async function fileInfo(root,file) {
  try{const filePath=await safeFile(root,file);const stat=await fs.stat(filePath);return stat.isFile()?{filePath,version:`${stat.size}-${Math.trunc(stat.mtimeMs)}`,size:stat.size}:null;}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
}
const fileUrl=(id,kind,version)=>`/api/gray-draft-file?id=${encodeURIComponent(id)}&kind=${kind}&v=${version}`;
const skinFileUrl=(id,skin,kind,version)=>`/api/gray-skin-file?id=${encodeURIComponent(id)}&skin=${encodeURIComponent(skin)}&kind=${kind}&v=${version}`;

async function beautificationInfo(root,entry) {
  const spec=entry.beautification;
  if(!spec||!spec.artifactsDirectory||!spec.skins||typeof spec.skins!=='object')return null;
  const directory=path.resolve(root,spec.artifactsDirectory);
  if(!inside(root,directory))throw new Error('美化试验产物目录必须位于项目内');
  const skins={};
  for(const [skin,item] of Object.entries(spec.skins)) {
    if(!/^[a-z][a-z0-9-]*$/.test(skin)||!item||typeof item.preview!=='string'||typeof item.pptx!=='string')continue;
    const preview=await fileInfo(root,path.join(directory,item.preview));
    const pptx=await fileInfo(root,path.join(directory,item.pptx));
    skins[skin]={label:item.label??skin,previewUrl:preview?skinFileUrl(entry.id,skin,'preview',preview.version):null,pptxUrl:pptx?skinFileUrl(entry.id,skin,'pptx',pptx.version):null};
  }
  return {page:Number.isInteger(spec.page)?spec.page:1,title:spec.title??'',status:spec.status??'awaiting-user-review',skins};
}

export async function collectGrayDrafts(projectRoot) {
  const root=path.resolve(projectRoot);
  return Promise.all((await entries(root)).map(async entry=>{
    const summary={id:entry.id,title:entry.title,description:entry.description,sourceLabel:entry.sourceLabel,versionLabel:entry.versionLabel};
    try{
      const {statePath,state,directory}=await context(root,entry);
      const metadata=state.grayDraft.coverage??state.grayDraft.reviewCases??[];
      const previewIndex=JSON.parse(await fs.readFile(await safeFile(root,path.join(directory,'preview-index.json')),'utf8'));
      const pages=await Promise.all(state.pages.map(async (page,index)=>{
        const meta=metadata.find(m=>m.pageId===page.pageId||m.page===index+1)??{};
        const preview=previewIndex.find(p=>p.pageId===page.pageId)?.preview;
        const info=preview?await fileInfo(root,path.resolve(directory,preview)):null;
        return {page:index+1,pageId:page.pageId,title:page.title,claim:page.claim,family:meta.family??'',pattern:meta.pattern??'',logic:meta.logic??'',size:meta.size??({large:'大',medium:'中',small:'小'}[meta.targetSize]??''),
          previewUrl:info?`/api/gray-draft-preview?id=${entry.id}&page=${index+1}&v=${info.version}`:null};
      }));
      const files=Object.fromEntries(await Promise.all(Object.entries({...fileNames,state:statePath}).map(async ([kind,file])=>{
        const info=await fileInfo(root,kind==='state'?file:path.join(directory,file));
        return [kind,info?fileUrl(entry.id,kind,info.version):null];
      })));
      return {...summary,available:true,pageCount:pages.length,pages,files,beautification:await beautificationInfo(root,entry),humanReview:state.grayDraft.humanReview??'pending',status:state.grayDraft.status??'awaiting-user-review',
        structureApplied:state.grayDraft.structureApplied===true,skinApplied:state.grayDraft.skinApplied===true};
    }catch(error){return {...summary,available:false,pageCount:0,pages:[],files:{},humanReview:'pending',error:error.message};}
  }));
}

// Request parameters select only registered artifacts and enumerated kinds/pages.
// No renderer is called on these read-only routes.
export async function resolveGrayDraftFile(projectRoot,{id,kind,page}) {
  const root=path.resolve(projectRoot);
  if(!['pptx','state','content','preview'].includes(kind))return null;
  const entry=(await entries(root)).find(entry=>entry.id===id);
  if(!entry)return null;
  const {statePath,state,directory}=await context(root,entry);
  let target;
  if(kind==='preview'){
    if(!/^\d+$/.test(String(page)))return null;
    const n=Number(page);
    if(!Number.isSafeInteger(n)||n<1||n>state.pages.length)return null;
    const index=JSON.parse(await fs.readFile(await safeFile(root,path.join(directory,'preview-index.json')),'utf8'));
    const preview=index.find(p=>p.pageId===state.pages[n-1].pageId)?.preview;
    if(!preview)return null;
    target=path.resolve(directory,preview);
  }else target=kind==='state'?statePath:path.join(directory,fileNames[kind]);
  const info=await fileInfo(root,target);
  if(!info)return null;
  const types={preview:'image/png',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',state:'application/json; charset=utf-8',content:'text/markdown; charset=utf-8'};
  return {...info,contentType:types[kind],fileName:kind==='pptx'?`${entry.title}.pptx`:path.basename(target)};
}

export async function resolveGraySkinFile(projectRoot,{id,skin,kind}) {
  const root=path.resolve(projectRoot);
  if(!['preview','pptx'].includes(kind)||!/^[a-z][a-z0-9-]*$/.test(String(skin??'')))return null;
  const entry=(await entries(root)).find(entry=>entry.id===id);
  if(!entry?.beautification?.artifactsDirectory)return null;
  const item=entry.beautification.skins?.[skin];
  if(!item)return null;
  const relative=kind==='preview'?item.preview:item.pptx;
  if(typeof relative!=='string')return null;
  const target=path.resolve(root,entry.beautification.artifactsDirectory,relative);
  const info=await fileInfo(root,target);
  if(!info)return null;
  return {...info,contentType:kind==='preview'?'image/png':'application/vnd.openxmlformats-officedocument.presentationml.presentation',fileName:path.basename(target)};
}
