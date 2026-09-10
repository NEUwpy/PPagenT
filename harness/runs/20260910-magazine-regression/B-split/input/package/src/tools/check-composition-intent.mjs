import fs from 'node:fs/promises';
import { checkCompositionIntents } from '../composition/intent.mjs';

try {
  if (process.argv.length !== 3) throw new Error('用法: node src/tools/check-composition-intent.mjs <composition-intent.json>');
  const result = checkCompositionIntents(JSON.parse(await fs.readFile(process.argv[2], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'passed') process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
