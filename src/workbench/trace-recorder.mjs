import fs from "node:fs/promises";
import path from "node:path";

function safeValue(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (/^(apiKey|authorization)$/i.test(key)) return "[REDACTED]";
    if (typeof item === "bigint") return String(item);
    if (item instanceof Error) return { name: item.name, code: item.code, message: item.message, stack: item.stack };
    return item;
  }));
}

function eventSummary(event, sequence, detailPath) {
  return {
    sequence,
    timestamp: new Date().toISOString(),
    source: event.source ?? "workbench",
    type: event.type ?? "event",
    status: event.status ?? "info",
    stage: event.stage ?? "workbench",
    callId: event.callId ?? null,
    attempt: event.attempt ?? null,
    durationMs: event.durationMs ?? null,
    provider: event.provider ?? null,
    model: event.model ?? null,
    endpoint: event.endpoint ?? null,
    usage: event.usage ?? null,
    error: event.error ?? null,
    detailPath,
  };
}

export function createTraceRecorder(runDir) {
  const eventsPath = path.join(runDir, "events.jsonl");
  const traceDir = path.join(runDir, "trace");
  let sequence = 0;
  let queue = Promise.resolve();

  async function write(event) {
    sequence += 1;
    const eventId = `event-${String(sequence).padStart(4, "0")}`;
    const detailPath = `trace/${eventId}.json`;
    const detail = safeValue({ ...event, eventId, sequence, timestamp: new Date().toISOString() });
    const summary = eventSummary(detail, sequence, detailPath);
    await fs.mkdir(traceDir, { recursive: true });
    await fs.writeFile(path.join(runDir, detailPath), `${JSON.stringify(detail, null, 2)}\n`, "utf8");
    await fs.appendFile(eventsPath, `${JSON.stringify(summary)}\n`, "utf8");
    return summary;
  }

  return {
    observe(event) {
      const task = queue.then(() => write(event));
      queue = task.catch(() => {});
      return task;
    },
    async flush() { await queue; },
  };
}

export async function readTraceEvents(runDir, after = 0) {
  try {
    const lines = (await fs.readFile(path.join(runDir, "events.jsonl"), "utf8"))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return lines.filter((event) => event.sequence > after);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}
