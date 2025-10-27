import fs from 'fs';
import { createApp } from './web/app.js';
import { PORT, publicDir, workflowsDir } from './web/config.js';

// 启动入口（仅做一件事：保证目录存在 -> 创建 Web 应用 -> 监听端口）

function ensureDirs() {
  // 仅确保目录存在，不写入任何文件，避免覆盖你已提供的 demo/bridge 页面
  fs.mkdirSync(workflowsDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
}

ensureDirs();
const app = createApp();
app.listen(PORT, () => {
  console.log(`[runner] listening on http://localhost:${PORT}`);
  console.log(`[runner] demo: http://localhost:${PORT}/demo`);
});
