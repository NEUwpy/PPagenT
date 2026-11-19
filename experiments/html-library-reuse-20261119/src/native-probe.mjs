import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveHtmlComponent,compileResolvedVisualTree,closeHtmlComponentRuntime} from '../../../src/visual-runtime/html-component-runtime.mjs';
import {Presentation,PresentationFile} from '../../../src/ppt-engine/index.mjs';
import {universityMckinseySkin} from '../../../src/runtime/skins/university-mckinsey.mjs';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const receipt=[];
try{
 for(const mode of ['a','b']){
  try{
   const html=await fs.readFile(path.join(E,`outputs/page-${mode}.html`),'utf8');
   const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
   let markup=html.slice(html.indexOf('</style>')+8).replace(/<\/html>\s*$/,'');
   markup=markup.replace('<div class="slide ', '<div data-ppt-root class="slide ');
   let index=0;
   markup=markup.replace(/<(h2|h3|p)\b([^>]*)>/g,(tag,t,attrs)=>attrs.includes('data-ppt-kind')?tag:`<${t} data-ppt-kind="text" data-ppt-name="page-${mode}-text-${++index}" ${attrs}>`);
   markup=markup.replace(/<div class="(shell-section|shell-band)"/g,(_,c)=>`<div class="${c}" data-ppt-kind="${c==='shell-band'?'shape-text':'text'}" data-ppt-name="${c}"`);
   markup=markup.replace(/<article class="(compliance|insight)"/g,(_,c)=>`<article class="${c}" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${c}-surface"`);
   markup=markup.replace(/data-ppt-kind="text"([^>]*class="group-title")/g,'data-ppt-kind="shape-text"$1');
   markup=markup.replace(/<div class="(shell-rule|shell-bottom)"/g,(_,c)=>`<div class="${c}" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${c}"`);
   const logo=(await fs.readFile(path.join(E,'assets/neu-logo.png'))).toString('base64');
   markup=markup.replace('class="shell-logo" src="../assets/neu-logo.png"',`class="shell-logo" data-ppt-kind="image" data-ppt-name="original-logo" src="data:image/png;base64,${logo}"`);
   const component={id:`library-reuse-page-${mode}`,schemaVersion:6,designFrame:{width:1280,height:720},cssText:css,renderMarkup:()=>markup};
   const frame={left:0,top:0,width:1280,height:720};
   const tree=await resolveHtmlComponent({component,parameters:{},assetDir:E,targetFrame:frame,theme:universityMckinseySkin,includeDocument:true,screenshotPath:path.join(E,`evidence/native-${mode}-resolved.png`)});
   await fs.writeFile(path.join(E,`evidence/native-${mode}-tree.json`),JSON.stringify(tree,null,2));
   const presentation=Presentation.create({slideSize:{width:1280,height:720}});
   const slide=presentation.slides.add();
   compileResolvedVisualTree(slide,tree,frame);
   await (await PresentationFile.exportPptx(presentation)).save(path.join(E,`outputs/page-${mode}-native-candidate.pptx`));
   await fs.mkdir(path.join(E,'evidence/native-inspection'),{recursive:true});
   try{await fs.rename(path.join(E,`outputs/page-${mode}-native-candidate.pptx.inspect.ndjson`),path.join(E,`evidence/native-inspection/page-${mode}.inspect.ndjson`));}catch(error){if(error.code!=='ENOENT')throw error;}
   receipt.push({page:mode,status:'exported',nodeCount:tree.nodes.length});
  }catch(error){receipt.push({page:mode,status:'blocked',code:error.code??null,message:error.message,stack:error.stack});}
 }
}finally{await closeHtmlComponentRuntime();await fs.writeFile(path.join(E,'evidence/native-probe.json'),JSON.stringify(receipt,null,2));}
console.log(JSON.stringify(receipt.map(({stack,...r})=>r)));
