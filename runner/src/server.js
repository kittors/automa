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
