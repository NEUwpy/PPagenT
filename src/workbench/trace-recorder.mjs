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
  /** null = 还没从既有事件里读出起点；读出后就是本次记录器已用到的最大序号。 */
  let sequence = null;
  let queue = Promise.resolve();

  /**
   * 续跑会在**同一个运行目录**上再开一个记录器。序号必须接着既有的往下排：
   * 前端是按 `sequence > after` 增量取事件的，新记录器若从 1 重新数，
   * 新事件的序号会落在前端已经拿到的 after 之下，于是永远拉不到——续跑在看板上看起来毫无动静。
   * 同一个记录器内只读一次，之后自增。
   */
  async function nextSequence() {
    if (sequence === null) sequence = (await readTraceEvents(runDir, 0)).at(-1)?.sequence ?? 0;
    sequence += 1;
    return sequence;
  }

  async function write(event) {
    const current = await nextSequence();
    const eventId = `event-${String(current).padStart(4, "0")}`;
    const detailPath = `trace/${eventId}.json`;
    const detail = safeValue({ ...event, eventId, sequence: current, timestamp: new Date().toISOString() });
    const summary = eventSummary(detail, current, detailPath);
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
