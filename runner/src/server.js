import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from './web/app.js';
import { PORT, publicDir, workflowsDir, buildDir, runnerRoot, OPEN_BRIDGE, HEADLESS, PROFILE_MODE, PERSIST_RUN_PROFILE } from './web/config.js';
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

app.listen(PORT, () => {
  console.log('[runner] ==============================================');
  console.log(`[runner] started at: ${startedAt.toISOString()}`);
  console.log(`[runner] node: ${process.version} | platform: ${os.platform()} ${os.arch()}`);
  const pw = resolvePackageVersion('playwright') || resolvePackageVersion('playwright-core');
  console.log(`[runner] playwright: ${pw ? 'v' + pw.version : '<unknown>'}`);
  console.log(`[runner] port: ${PORT}`);
  console.log(`[runner] runnerRoot: ${runnerRoot}`);
  console.log(`[runner] publicDir: ${publicDir}`);
  console.log(`[runner] workflowsDir: ${workflowsDir}`);
  console.log(`[runner] buildDir: ${buildDir}`);
  console.log(`[runner] options: OPEN_BRIDGE=${OPEN_BRIDGE} HEADLESS=${HEADLESS} PROFILE_MODE=${PROFILE_MODE} PERSIST_RUN_PROFILE=${PERSIST_RUN_PROFILE}`);
  console.log(`[runner] build/manifest.json: ${hasManifest ? 'found' : 'missing'}`);
  console.log(`[runner] health: http://localhost:${PORT}/health`);
  console.log(`[runner] demo:   http://localhost:${PORT}/demo`);
  console.log('[runner] ==============================================');
});

// 兜底错误输出
process.on('unhandledRejection', (e) => {
  console.error('[runner] unhandledRejection:', e);
});
process.on('uncaughtException', (e) => {
  console.error('[runner] uncaughtException:', e);
});
