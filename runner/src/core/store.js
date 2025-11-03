// 简单内存态存储：仅在进程生命周期内保存一次运行的状态/日志
import { printSseEntry } from './logger.js';
const runs = new Map();

// 初始化一次运行（返回可变状态对象）
export function initRun(runId) {
  const state = { id: runId, status: 'queued', createdAt: new Date().toISOString(), logs: [] };
  runs.set(runId, state);
  return state;
}

// 获取运行状态
export function getRun(runId) {
  return runs.get(runId);
}

// 追加日志并广播给 SSE 监听者，并在服务端以彩色输出
export function pushLog(runId, entry) {
  const s = runs.get(runId);
  if (!s) return;
  s.logs.push(entry);
  s.lastLogAt = entry.ts;
  const listeners = s.__listeners || [];
  for (const res of listeners) res.write(`data: ${JSON.stringify(entry)}\n\n`);

  try { printSseEntry(runId, entry); } catch (_) {}
}

// 订阅指定运行的日志流（SSE）
export function addListener(runId, res) {
  const s = runs.get(runId);
  if (!s) return false;
  if (!s.__listeners) s.__listeners = [];
  s.__listeners.push(res);
  return true;
}

// 取消订阅
export function removeListener(runId, res) {
  const s = runs.get(runId);
  if (!s || !s.__listeners) return;
  s.__listeners = s.__listeners.filter((r) => r !== res);
}
