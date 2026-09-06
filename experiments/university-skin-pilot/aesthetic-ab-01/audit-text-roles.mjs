import fs from 'node:fs/promises';
import path from 'node:path';

// Parent-side read-only audit: compare declarations with exported objects, not with builder defaults.
const [run]=process.argv.slice(2);
if(!run)throw new Error('Usage: node audit-text-roles.mjs RUN');
const expected={cover:[44,true],claim:[30,true],group:[21,true],body:[18,false],note:[16,false],footer:[12,false],metric:[36,true]};
const raw=JSON.parse(await fs.readFile(path.join(run,'text-roles.json'),'utf8'));
const roles=Array.isArray(raw)?raw:raw.roles;
if(!Array.isArray(roles))throw new Error('Unsupported manifest; requires roles array');
const layouts=(await fs.readdir(run)).filter(n=>/^slide-\d+\.layout\.json$/.test(n));
const actual=new Map();
for(const file of layouts){
 const data=JSON.parse(await fs.readFile(path.join(run,file),'utf8'));
 const page=Number(file.match(/\d+/)[0]);
 for(const el of data.elements??[]){if(el.text?.trim())actual.set(`${page}:${el.id}`,{page,...el});}
}
const issues=[],checked=[],seen=new Set();
for(const r of roles){
 // Executors use either page/shapeId or slide/shape; both refer to exported IDs.
 const key=`${r.page??r.slide}:${r.shapeId??r.id??r.shape}`;
 const role=r.role??r.declaredRole;
 if(seen.has(key))issues.push({key,issue:'duplicate-declaration'});
 seen.add(key);
 const el=actual.get(key);
 if(!el){issues.push({key,issue:'missing-actual-text'});continue;}
 const style=el.resolvedTextStyle??{};
 const exp=expected[role];
 if(!exp){issues.push({key,issue:'unknown-role',role});continue;}
 const size=style.fontSize??el.resolvedFontSize,bold=Boolean(style.bold);
 if(Math.abs(size-exp[0])>.05||bold!==exp[1])issues.push({key,issue:'role-style-mismatch',role,expected:exp,actual:[size,bold],text:el.text});
 if(style.typeface!=='Microsoft YaHei')issues.push({key,issue:'font-mismatch',font:style.typeface});
 checked.push({key,role,size,bold,text:el.text});
}
for(const [key,el] of actual)if(!seen.has(key))issues.push({key,issue:'undeclared-text',text:el.text});
console.log(JSON.stringify({scope:'Declared base typography against exported layout. Partial rich-text spans and semantic role suitability require separate review; this is not style acceptance.',actualTextCount:actual.size,declarationCount:roles.length,checkedCount:checked.length,issueCount:issues.length,issues,checked},null,2));
process.exitCode=issues.length?1:0;
