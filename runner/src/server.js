import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from './web/app.js';
import { HOST, PORT, publicDir, workflowsDir, buildDir, runnerRoot, OPEN_BRIDGE, HEADLESS, PROFILE_MODE, PERSIST_RUN_PROFILE, PW_DEBUG } from './web/config.js';
import { printStartupBanner, logger } from './core/logger.js';
import { createRequire } from 'module';

// 启动入口（仅做一件事：保证目录存在 -> 创建 Web 应用 -> 监听端口）

function ensureDirs() {
  // 仅确保目录存在，不写入任何文件，避免覆盖你已提供的 demo/bridge 页面
  fs.mkdirSync(workflowsDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
}

ensureDirs();
const app = createApp();

let viteDev = null; // Vite 开发服务器（中间件模式）
async function setupViteDev() {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    const configFile = path.join(runnerRoot, 'demo', 'vite.config.mjs');
    if (!fs.existsSync(configFile)) return;
    const vite = await import('vite');
    viteDev = await vite.createServer({
      configFile,
      server: { middlewareMode: true },
      appType: 'custom',
      // root 由 configFile 决定
    });
    app.use(viteDev.middlewares);
    logger.info('[runner] vite dev middleware attached');
  } catch (e) {
    logger.warn('[runner] vite dev setup failed: ' + (e?.message || e));
  }
}
await setupViteDev();

// 在开发模式下，若 Vue Demo 产物不存在，则自动构建一次
async function ensureDemoBuilt() {
  try {
    const builtIndex = path.join(publicDir, 'demo', 'index.html');
    if (fs.existsSync(builtIndex)) return;
    // 若已启用 Vite 中间件开发，则无需构建
    if (process.env.NODE_ENV === 'development' && viteDev) return;
    if (process.env.NODE_ENV !== 'development') return;
    const configFile = path.join(runnerRoot, 'demo', 'vite.config.mjs');
    if (!fs.existsSync(configFile)) return;
    logger.info('[runner] building demo (vite)...');
    const vite = await import('vite');
    await vite.build({ configFile });
    logger.info('[runner] demo built to public/demo');
  } catch (e) {
    logger.warn('[runner] demo auto-build skipped: ' + (e?.message || e));
  }
}

// 触发一次（不阻塞启动）
ensureDemoBuilt();

// Demo 路由：若未构建则在开发模式下即时构建后返回页面
app.get('/demo', async (req, res) => {
  try {
    // 开发模式：通过 Vite 中间件提供 HMR 与按需编译
    if (viteDev) {
      const indexPath = path.join(runnerRoot, 'demo', 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');
      html = await viteDev.transformIndexHtml(req.originalUrl || '/demo', html);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(html);
    }
    const built = path.join(publicDir, 'demo', 'index.html');
    if (!fs.existsSync(built) && process.env.NODE_ENV === 'development') {
      await ensureDemoBuilt();
    }
    if (fs.existsSync(built)) return res.sendFile(built);
    res.status(404).send('Demo not built. Run pnpm run demo:build');
  } catch (e) {
    res.status(500).send('Failed to build demo: ' + (e?.message || e));
  }
});

// 尝试解析 Playwright 版本（避免被 package.exports 限制）
function resolvePackageVersion(pkgName) {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve(pkgName);
    let dir = path.dirname(entry);
    for (let i = 0; i < 8; i++) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (json && json.name && json.version) return { name: json.name, version: json.version };
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch (_) {}
  return null;
}

const startedAt = new Date();
const manifestPath = path.join(buildDir, 'manifest.json');
const hasManifest = fs.existsSync(manifestPath);

app.listen(PORT, HOST, () => {
  const pw = resolvePackageVersion('playwright') || resolvePackageVersion('playwright-core');
  printStartupBanner({
    startedAt,
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    playwright: pw ? `v${pw.version}` : '<unknown>',
    port: PORT,
    runnerRoot,
    publicDir,
    workflowsDir,
    buildDir,
    buildReady: hasManifest,
    options: `OPEN_BRIDGE=${OPEN_BRIDGE} HEADLESS=${HEADLESS} PROFILE_MODE=${PROFILE_MODE} PERSIST_RUN_PROFILE=${PERSIST_RUN_PROFILE} PW_DEBUG=${PW_DEBUG || '<off>'}`,
  });
});

// 兜底错误输出
process.on('unhandledRejection', (e) => logger.error('[runner] unhandledRejection:', e));
process.on('uncaughtException', (e) => logger.error('[runner] uncaughtException:', e));
