import fs from "node:fs/promises";
import path from "node:path";
import { readTraceEvents } from "./trace-recorder.mjs";

async function readDetail(runDir, event) {
  if (!event.detailPath) return null;
  try { return JSON.parse(await fs.readFile(path.join(runDir, event.detailPath), "utf8")); }
  catch { return null; }
}

/**
 * 工作台只把 events.jsonl + trace/*.json 编译成视图，不另存一份流程事实。
 * 每个阶段保留输入/输出序列和最后状态，便于调试模型理解、JEV 选择及程序步骤。
 */
export async function compileRunLog(runDir) {
  const events = await readTraceEvents(runDir, 0);
  const stages = {};
  for (const event of events) {
    const detail = await readDetail(runDir, event);
    const stage = event.stage ?? "workbench";
    const item = stages[stage] ?? { stage, status: "pending", events: [], inputs: [], outputs: [] };
    item.status = event.status ?? item.status;
    item.events.push({ sequence: event.sequence, type: event.type, status: event.status, timestamp: event.timestamp, detailPath: event.detailPath });
    if (detail?.input !== undefined) item.inputs.push({ sequence: event.sequence, value: detail.input });
    if (detail?.output !== undefined) item.outputs.push({ sequence: event.sequence, value: detail.output });
    if (detail?.error !== undefined) item.error = detail.error;
    stages[stage] = item;
  }
  return {
    schemaVersion: "run-log-view-1",
    source: "events.jsonl + trace/*.json",
    lastSequence: events.at(-1)?.sequence ?? 0,
    stages,
  };
}

