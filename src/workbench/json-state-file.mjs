import fs from "node:fs/promises";
import path from "node:path";

const writeQueues = new Map();

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function writeJsonState(target, value) {
  const resolved = path.resolve(target);
  const previous = writeQueues.get(resolved) ?? Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    });
  writeQueues.set(resolved, current);
  try {
    await current;
  } finally {
    if (writeQueues.get(resolved) === current) writeQueues.delete(resolved);
  }
}

export async function readJsonState(target, { attempts = 12, retryDelayMs = 10 } = {}) {
  const resolved = path.resolve(target);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return JSON.parse(await fs.readFile(resolved, "utf8"));
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !["ENOENT", "EACCES", "EPERM"].includes(error?.code) && !(error instanceof SyntaxError)) {
        throw error;
      }
      await delay(retryDelayMs);
    }
  }
  throw lastError;
}
