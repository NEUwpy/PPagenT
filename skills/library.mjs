import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function resolveInside(root, relative) {
  const target = path.resolve(root, relative);
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Path outside project: ${relative}`);
  return target;
}
export async function listSkills(root = defaultRoot) {
  const registry = JSON.parse(await fs.readFile(path.join(root,'skills/registry.json'),'utf8'));
  return [...registry.skills].sort((a,b)=>(a.selectionPriority??99)-(b.selectionPriority??99));
}
export async function getSkillBinding(id, root = defaultRoot) {
  const entry = (await listSkills(root)).find(s => s.id === id);
  if (!entry) throw new Error(`Unknown skill: ${id}`);
  const instruction = await fs.readFile(resolveInside(root,entry.entry),'utf8');
  const integration = await fs.readFile(resolveInside(root,entry.integration),'utf8');
  const registry = JSON.parse(await fs.readFile(path.join(root,'skills/registry.json'),'utf8'));
  const selectionInstruction = registry.selectionPolicy ? await fs.readFile(resolveInside(root,registry.selectionPolicy),'utf8') : '';
  return { ...entry, instruction, integrationInstruction:integration,
    selectionInstruction,
    workingDirectory:'.', skillDirectory:entry.root,
    hostRequirements:['read project files','run local processes','inspect rendered artifacts'],
    hostBindingStatus:'descriptor-only; host tool registration is required' };
}
export async function verifySkill(id, root = defaultRoot) {
  const binding = await getSkillBinding(id,root);
  if (!binding.integrityFile) return {id,entryReadable:true,integrity:'project-owned; not pinned'};
  const inventory = JSON.parse(await fs.readFile(resolveInside(root,binding.integrityFile),'utf8'));
  const mismatches = [];
  for (const [relative, expected] of Object.entries(inventory.files)) {
    try {
      const bytes = await fs.readFile(resolveInside(root,path.join(binding.root,relative)));
      if (createHash('sha256').update(bytes).digest('hex') !== expected) mismatches.push(relative);
    } catch { mismatches.push(relative); }
  }
  return {id,entryReadable:true,integrity:mismatches.length?'failed':'passed',fileCount:Object.keys(inventory.files).length,mismatches};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command,id] = process.argv.slice(2);
  try {
    const result = command === 'list' ? await listSkills()
      : command === 'bind' ? await getSkillBinding(id)
      : command === 'verify' ? await verifySkill(id)
      : (() => {throw new Error('Usage: node skills/library.mjs list | bind <id> | verify <id>');})();
    console.log(JSON.stringify(result,null,2));
    if (result.integrity === 'failed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
