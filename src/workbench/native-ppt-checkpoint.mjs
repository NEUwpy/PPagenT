import fs from "node:fs/promises";
import path from "node:path";
import { readJsonState, writeJsonState } from "./json-state-file.mjs";

export function createNativePptCheckpoint({ runDir, onAwaiting, onResumed } = {}) {
  const checkpointDir = path.join(runDir, "checkpoint");
  const checkpointPath = path.join(checkpointDir, "native-ppt.json");
  let state = null;
  let resolvePending = null;
  let rejectPending = null;

  async function pause(preview) {
    if (resolvePending) throw new Error("Native PPT 预览已经在等待确认");
    const pending = new Promise((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    state = {
      schemaVersion: "1.0",
      stage: "native-preview",
      status: "awaiting-user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preview,
    };
    await fs.mkdir(checkpointDir, { recursive: true });
    await writeJsonState(checkpointPath, state);
    await onAwaiting?.(structuredClone(state));
    return pending;
  }

  async function approve() {
    if (!state || state.status !== "awaiting-user" || !resolvePending) {
      const error = new Error("当前运行没有等待确认的 Native PPT 预览");
      error.statusCode = 409;
      throw error;
    }
    state = { ...state, status: "approved", updatedAt: new Date().toISOString() };
    await writeJsonState(checkpointPath, state);
    await onResumed?.(structuredClone(state));
    const resolve = resolvePending;
    resolvePending = null;
    rejectPending = null;
    resolve({ ...state.preview, approvalStatus: "approved", approvedAt: state.updatedAt });
    return structuredClone(state);
  }

  async function cancel() {
    if (!state || state.status !== "awaiting-user" || !rejectPending) {
      const error = new Error("当前运行没有可取消的 Native PPT 预览");
      error.statusCode = 409;
      throw error;
    }
    state = { ...state, status: "cancelled", updatedAt: new Date().toISOString() };
    await writeJsonState(checkpointPath, state);
    const reject = rejectPending;
    resolvePending = null;
    rejectPending = null;
    const error = new Error("用户删除了等待确认的运行");
    error.code = "WORKBENCH_RUN_CANCELLED";
    error.stage = "native-preview";
    reject(error);
    return structuredClone(state);
  }

  return { checkpointPath, pause, approve, cancel, read: () => structuredClone(state) };
}

export async function readNativePptCheckpoint(runDir) {
  return readJsonState(path.join(runDir, "checkpoint", "native-ppt.json"));
}
