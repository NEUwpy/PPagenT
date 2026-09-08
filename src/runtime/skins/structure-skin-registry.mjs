import fs from 'node:fs/promises';
import path from 'node:path';
import { derivePrimaryTheme } from './primary-tone-palette.mjs';
import { neutralEditorialTheme } from './neutral-editorial-theme.mjs';
import { northeasternUniversityTheme } from './northeastern-university-theme.mjs';

export function validateStructureSkin(config) {
  if (!/^[a-z][a-z0-9-]+$/.test(config.id ?? '') || ['neutral','university','neutral-editorial-001','northeastern-university-001'].includes(config.id)) throw new Error('Skin id 非法或与内置 Skin 重复');
  if (!config.name?.trim() || !/^#[0-9a-f]{6}$/i.test(config.mainColor ?? '')) throw new Error('需要名称和六位十六进制主色');
  if (config.mode !== 'continuous-tone-v1') throw new Error('未知结构配色模式');
  if (!config.fonts?.body || !config.fonts?.display) throw new Error('需要正文与标题字体');
  if (!['candidate','reviewed'].includes(config.status)) throw new Error('Skin 状态必须为 candidate 或 reviewed');
  if(config.status==='reviewed' && (!config.evidence || !config.reviewedAt))throw new Error('已审阅 Skin 必须记录证据和审阅日期');
  return config;
}

export async function listStructureSkins(root) {
  const skins=[
    {id:'university',name:'东北大学 Skin',status:'existing',theme:northeasternUniversityTheme},
    {id:'neutral',name:'中性 Skin',status:'reviewed',theme:{...neutralEditorialTheme,structureColorMode:'continuous-tone-v1'},evidence:'experiments/structure-unified-neutral/index.html'},
  ];
  const directory=path.join(root,'catalog','structure-skins');
  let files;
  try {files=await fs.readdir(directory);} catch(error) {if(error.code==='ENOENT')return skins;throw error;}
  for(const file of files.filter(f=>f.endsWith('.json')).sort()) {
    const config=validateStructureSkin(JSON.parse(await fs.readFile(path.join(directory,file),'utf8')));
    if(config.evidence){
      const evidence=path.resolve(root,config.evidence),relative=path.relative(root,evidence);
      if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('审阅证据必须位于仓库内');
      await fs.access(evidence);
    }
    if(skins.some(s=>s.id===config.id))throw new Error('重复 Skin id: '+config.id);
    skins.push({...config,theme:{...derivePrimaryTheme({...config,font:config.fonts.body,typography:neutralEditorialTheme.typography},config.mainColor),structureColorMode:config.mode}});
  }
  return skins;
}
