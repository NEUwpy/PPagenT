import fs from 'node:fs/promises';
import path from 'node:path';
import { executeStructureSkill } from '../../../../src/runtime/structure-skills.mjs';
export async function invokeStructure(options) {
  const { evidencePath, pageId, regionId, reason, references, targetFrame } = options;
  if (!evidencePath || !pageId || !regionId || !reason) throw new Error('调用需 evidencePath/pageId/regionId/reason');
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  const log = event => fs.appendFile(evidencePath, JSON.stringify({ at: new Date().toISOString(), pageId, regionId, reason, references, targetFrame, ...event }) + '\n');
  await log({ event: 'attempt', executor: 'structure-skill-native' });
  try {
    const result = await executeStructureSkill(options);
    await log({ event: 'success', nativeShapeDelta: result.nativeShapeDelta, validation: result.validation });
    return result;
  } catch (error) {
    await log({ event: 'failure', message: error.message, partialOutputPossible: true });
    throw error;
  }
}
// Compatibility for existing finally blocks; this executor owns no browser.
export async function closeStructureRuntime() {}
