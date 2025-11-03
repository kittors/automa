import fs from 'fs';
import path from 'path';
import { runnerRoot, buildDir, PORT, OPEN_BRIDGE, HEADLESS, PROFILE_MODE, PERSIST_RUN_PROFILE } from '../web/config.js';
import { readJSON, delay, now } from './utils.js';
import {
  launchContext,
  attachLogging,
  findExtensionIdViaCDP,
  findExtensionIdFromProfile,
  closeWelcomePages,
  openBridgePage,
} from './browser.js';
import { triggerViaExecutePage } from './trigger.js';

// 整体运行流程：
// 1) 启动持久化浏览器上下文（加载扩展）
// 2) 解析扩展 ID（CDP 优先，失败回落扫描用户目录）
// 3) 关闭扩展欢迎页（避免打扰）
// 4) 打开 execute.html 并向 background 发送执行消息
// 5) 等待一段时间便于观察日志/页面行为，最后关闭上下文
export async function runWorkflow({ runId, workflow, variables = {}, timeoutMs = 120000, log, openBridge = OPEN_BRIDGE }) {
  const userDataDir = PROFILE_MODE === 'per-run'
    ? path.join(runnerRoot, '.tmp', 'profiles', runId)
    : path.join(runnerRoot, '.profile');

  const manifestPath = path.join(buildDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Extension build not found. Ensure ../build exists');
  const { name: extName, version: extVersion } = readJSON(manifestPath);

  const context = await launchContext({ buildDir, userDataDir, headless: HEADLESS });
  attachLogging(context, log);
  // 可选：打开本地 bridge 页面，作为一个常规 HTTP 页签存在
  if (openBridge) await openBridgePage(context, { port: PORT, log });

  let extId;
  try {
    extId = await findExtensionIdViaCDP(context, 10000);
    log({ type: 'info', text: `Extension ID (CDP): ${extId}`, ts: now() });
  } catch (e) {
    log({ type: 'warn', text: `CDP detect failed: ${e.message}. Fallback to profile scan...`, ts: now() });
    extId = await findExtensionIdFromProfile({ userDataDir, name: extName, version: extVersion, readJSON });
    log({ type: 'info', text: `Extension ID (FS): ${extId}`, ts: now() });
  }

  await closeWelcomePages(context, extId);
  await triggerViaExecutePage(context, extId, workflow, variables, log);

  const endAt = Date.now() + timeoutMs;
  while (Date.now() < endAt) await delay(1000);

  await context.close();
  // 清理 per-run 的用户目录（可保留用于排查）
  if (PROFILE_MODE === 'per-run' && !PERSIST_RUN_PROFILE) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}
