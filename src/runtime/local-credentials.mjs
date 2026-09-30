import fs from "node:fs/promises";
import path from "node:path";

export async function loadCredentialValues(root) {
  let text;
  try { text = await fs.readFile(path.join(path.resolve(root), "config", "credentials.local.md"), "utf8"); }
  catch (error) { if (error.code === "ENOENT") return {}; throw error; }
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

export async function loadDeepSeekLocalConfig(root) {
  let local = {};
  try { local = JSON.parse(await fs.readFile(path.join(path.resolve(root), "config", "deepseek.local.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const credentials = await loadCredentialValues(root);
  return { ...local,
    ...(credentials.DEEPSEEK_API_KEY ? { apiKey: credentials.DEEPSEEK_API_KEY } : {}),
    ...(credentials.PPAGENT_DEEPSEEK_MODEL ? { model: credentials.PPAGENT_DEEPSEEK_MODEL } : {}),
    ...(credentials.PPAGENT_DEEPSEEK_ENDPOINT ? { endpoint: credentials.PPAGENT_DEEPSEEK_ENDPOINT } : {}),
  };
}
