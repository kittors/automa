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
    const configFile = path.join(runnerRoot, 'views', 'vite.config.mjs');
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
async function ensureViewsBuilt() {
  try {
    const builtIndex = path.join(publicDir, 'views', 'index.html');
    if (fs.existsSync(builtIndex)) return;
    // 若已启用 Vite 中间件开发，则无需构建
    if (process.env.NODE_ENV === 'development' && viteDev) return;
    if (process.env.NODE_ENV !== 'development') return;
    const configFile = path.join(runnerRoot, 'views', 'vite.config.mjs');
    if (!fs.existsSync(configFile)) return;
    logger.info('[runner] building views (vite)...');
    const vite = await import('vite');
    await vite.build({ configFile });
    logger.info('[runner] views built to public/views');
  } catch (e) {
    logger.warn('[runner] views auto-build skipped: ' + (e?.message || e));
  }
}

// 触发一次（不阻塞启动）
ensureViewsBuilt();

// 前端视图：支持 /app、/app/*、/scheduler、/scheduler/*
async function serveSpa(req, res) {
  try {
    if (viteDev) {
      const indexPath = path.join(runnerRoot, 'views', 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');
      html = await viteDev.transformIndexHtml(req.originalUrl || '/app', html);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(html);
    }
    const built = path.join(publicDir, 'views', 'index.html');
    if (!fs.existsSync(built) && process.env.NODE_ENV === 'development') {
      await ensureViewsBuilt();
    }
    if (fs.existsSync(built)) return res.sendFile(built);
    res.status(404).send('App not built. Run pnpm run web:build');
  } catch (e) {
    res.status(500).send('Failed to build app: ' + (e?.message || e));
  }
}

app.get('/app', serveSpa);
app.get('/app/*', serveSpa);
app.get('/scheduler', serveSpa);
app.get('/scheduler/*', serveSpa);

// 根路径：服务运行状态页面
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"/>
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>
  <title>Runner 服务正在运行</title>
  <style>
    :root{ --bg:#0b1020; --card:#0f172a; --muted:#93a4c1; --line:#1f2a44; --blue:#3b82f6; --green:#22c55e; }
    *{ box-sizing:border-box }
    body{ margin:0; background: linear-gradient(180deg,#0b1020 0%, #0b1426 60%, #0c172e 100%);
          color:#e5e7eb; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial; min-height:100vh; }
    .wrap{ max-width:920px; margin:0 auto; padding:40px 20px; }
    .header{ display:flex; align-items:center; gap:14px; margin-bottom:16px; }
    .badge{ width:12px; height:12px; background: var(--green); border-radius:50%; box-shadow:0 0 0 4px rgba(34,197,94,.15); }
    h1{ margin:0; font-size:24px; font-weight:800; letter-spacing:.5px; }
    p.sub{ margin:6px 0 18px; color:var(--muted) }
    .grid{ display:grid; grid-template-columns: 1fr; gap:14px; }
    @media(min-width:880px){ .grid{ grid-template-columns: 1fr 1fr; } }
    .card{ background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
           border:1px solid var(--line); border-radius:16px; padding:18px; backdrop-filter:saturate(140%) blur(2px);
           box-shadow: 0 12px 28px rgba(17,24,39,.35), inset 0 1px 0 rgba(255,255,255,.04); }
    .card h3{ margin:0 0 8px; font-size:16px; font-weight:700; }
    .kv{ display:flex; align-items:center; gap:8px; color:var(--muted) }
    .links{ display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
    a.btn{ display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:10px; text-decoration:none;
           color:#e6f0ff; background:linear-gradient(180deg,#1f3b7b,#27468e); border:1px solid rgba(99,102,241,.35);
           box-shadow: 0 6px 18px rgba(59,130,246,.25); transition: transform .06s ease, filter .12s ease; }
    a.btn:hover{ filter: brightness(1.08) }
    a.btn:active{ transform: translateY(1px) }
    .pill{ display:inline-block; padding:2px 8px; border-radius:999px; background:rgba(34,197,94,.15); color:#86efac; border:1px solid rgba(34,197,94,.35); font-size:12px; }
    .muted{ color:var(--muted) }
    .mono{ font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  </style></head>
  <body>
    <div class=\"wrap\">
      <div class=\"header\"><span class=\"badge\"></span><h1>Runner 服务正在运行</h1></div>
      <p class=\"sub\">欢迎使用本地工作流运行服务。下面是一些快速入口和当前环境信息。</p>

      <div class=\"grid\">
        <div class=\"card\">
          <h3>快速入口</h3>
          <div class=\"links\">
            <a class=\"btn\" href=\"/app\">进入 · 工作流执行</a>
            <a class=\"btn\" href=\"/scheduler\">进入 · 定时器编排</a>
            <a class=\"btn\" href=\"/health\">查看 · 健康检查</a>
          </div>
        </div>
        <div class=\"card\">
          <h3>运行信息</h3>
          <div class=\"kv\">端口：<span class=\"mono\">${PORT}</span> <span class=\"pill\">online</span></div>
          <div class=\"kv\">环境：<span class=\"mono\">Node ${process.version}</span></div>
          <div class=\"kv\">目录：<span class=\"mono\">/runner/public/views</span>（前端构建）</div>
        </div>
      </div>
    </div>
  </body></html>`);
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
