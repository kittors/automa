import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { delay, now } from './utils.js';

// 启动持久化浏览器上下文（加载扩展 + 关闭首次启动提示）
export async function launchContext({ buildDir, userDataDir, headless = false }) {
  fs.mkdirSync(userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: [
      `--disable-extensions-except=${buildDir}`,
      `--load-extension=${buildDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-session-crashed-bubble',
    ],
  });
  return context;
}

// 为上下文内的所有页面绑定日志事件，便于在后端观察运行过程
export function attachLogging(context, log) {
  const attach = (page) => {
    page.on('console', (msg) => log({ type: 'console', text: msg.text(), ts: now() }));
    page.on('pageerror', (err) => log({ type: 'pageerror', text: err.message, ts: now() }));
    page.on('requestfailed', (req) =>
      log({ type: 'requestfailed', text: `${req.failure()?.errorText} ${req.url()}`, ts: now() })
    );
    page.on('framenavigated', (frame) => {
      if (frame.parentFrame()) return;
      log({ type: 'navigated', text: frame.url(), ts: now() });
    });
  };
  context.pages().forEach(attach);
  context.on('page', attach);
}

// 通过 CDP 查询扩展的 service_worker，从其 URL 中解析扩展 ID（更稳）
export async function findExtensionIdViaCDP(context, timeoutMs = 15000) {
  const client = await context.browser().newBrowserCDPSession();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { targetInfos } = await client.send('Target.getTargets');
      const extTarget = (targetInfos || []).find(
        (t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://')
      );
      if (extTarget) return new URL(extTarget.url).host;
    } catch (_) {}
    await delay(200);
  }
  throw new Error('Failed to detect extension ID via CDP');
}

// 从持久化用户目录扫描扩展，兜底解析扩展 ID
export async function findExtensionIdFromProfile({ userDataDir, name, version, timeoutMs = 15000, readJSON }) {
  const start = Date.now();
  const extRoot = path.join(userDataDir, 'Default', 'Extensions');
  for (;;) {
    if (fs.existsSync(extRoot)) {
      const ids = fs.readdirSync(extRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      for (const id of ids) {
        const idDir = path.join(extRoot, id);
        const versions = fs.readdirSync(idDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
        for (const ver of versions) {
          const manifestPath = path.join(idDir, ver, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const m = readJSON(manifestPath);
              if (m && m.name === name && (!version || m.version === version)) return id;
            } catch (_) {}
          }
        }
      }
    }
    if (Date.now() - start > timeoutMs) break;
    await delay(200);
  }
  throw new Error('Failed to find extension ID in user profile');
}

// 关闭扩展首次安装时自动打开的欢迎页，避免干扰
export async function closeWelcomePages(context, extId) {
  for (const p of context.pages()) {
    try {
      if (p.url().startsWith(`chrome-extension://${extId}/newtab.html`)) await p.close();
    } catch (e) {}
  }
}

// 打开一个普通 HTTP 页面（bridge.html），保持一个“用户页签”，同时输出日志
export async function openBridgePage(context, { port, log }) {
  const page = await context.newPage();
  await page.goto(`http://localhost:${port}/bridge.html`);
  log({ type: 'info', text: 'Bridge page opened', ts: now() });
  return page;
}
