// 简单内存态存储：仅在进程生命周期内保存一次运行的状态/日志
import { printSseEntry } from './logger.js';
const runs = new Map();
// 全局运行列表的 SSE 监听者
const runsListeners = new Set();
const runtimes = new Map(); // 仅进程内使用：存放上下文等运行时对象，不对外返回

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
  const wrapped = { code: 200, msg: '', data: entry };
  for (const res of listeners) res.write(`data: ${JSON.stringify(wrapped)}\n\n`);

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

// 列出所有运行（浅拷贝，避免将内部字段如 __listeners 泄露）
export function listRuns({ status } = {}) {
  const arr = [];
  for (const s of runs.values()) {
    if (status && s.status !== status) continue;
    const { __listeners, ...pub } = s;
    arr.push({ ...pub });
  }
  // 最近的在前（按创建时间排序）
  arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return arr;
}

// 运行时对象：context/标志位等（不序列化）
export function setRuntime(runId, data) { runtimes.set(runId, data || {}); }
export function getRuntime(runId) { return runtimes.get(runId); }
export function clearRuntime(runId) { runtimes.delete(runId); }

// 运行列表的 SSE：订阅/取消/通知
export function addRunsListener(res) { runsListeners.add(res); }
export function removeRunsListener(res) { runsListeners.delete(res); }
export function notifyRunsChanged(payload) {
  const data = payload || { items: listRuns() };
  const line = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of runsListeners) {
    try { res.write(line); } catch (_) {}
  }
}
