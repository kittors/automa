Automa Runner（基于 Playwright 的 API 服务）

背景与目标
- 在不改动浏览器扩展源码的前提下，通过后台 API 一键触发“工作流执行”。
- 使用 Playwright 启动 Chromium 并加载扩展（源自仓库 `../build`），在本地可视化观察执行过程。

方案设计（关键点）
- 扩展加载：使用 `chromium.launchPersistentContext` 加载 `../build`，并启用“可见模式”（headless: false）。
- 触发执行：打开扩展页 `execute.html`，在该页上下文中调用 `chrome.runtime.sendMessage({ name: 'background--workflow:execute', data: {...} })` 直接触发后台执行。
  - 不写入 storage，不触发 `workflow:added`，因此不会打开 Dashboard/Popup。
  - 通过 `options.checkParams = false` 跳过扩展端参数收集 UI。
- 扩展 ID 解析：优先通过 CDP 从 service worker 解析扩展 ID，失败再扫描用户目录。
- 稳定性：使用持久化用户目录 `runner/.profile`，并添加 `--no-first-run` 等参数避免“恢复窗口”提示。

Runner 模块结构
- 启动入口
  - `src/server.js`：仅负责创建目录、启动 Web 应用、监听端口。
- Web 层（轻）
  - `src/web/config.js`：路径与常量（PORT、publicDir、workflowsDir、buildDir）。
  - `src/web/app.js`：Express 应用，提供静态页面与 API（POST /api/runs、GET /api/runs/:id、SSE /api/runs/:id/stream）。
- 核心层（解耦 Playwright/扩展逻辑）
  - `src/core/run.js`：组合整体运行流程（启动上下文 → 解析扩展 ID → 关闭欢迎页 → 触发执行 → 等待 → 关闭）。
  - `src/core/browser.js`：浏览器与扩展相关工具（启动、日志绑定、扩展 ID 查找、关闭欢迎页、打开 bridge）。
  - `src/core/trigger.js`：触发执行的最小实现（execute.html + runtime 消息）。
  - `src/core/store.js`：一次运行的内存态与 SSE 订阅。
  - `src/core/utils.js`：通用函数（now/delay/readJSON）。
- 静态与工作流
  - `public/demo.html`：演示页面（点击按钮 → 调用 API → 显示实时日志）。
  - `public/bridge.html`：普通 http 页面（保持一个用户页签，无逻辑要求）。
  - `workflows/*.json`：工作流文件示例（默认 `baidu-search.json`）。

执行链路
1) Demo 页面调用 `POST /api/runs`，传入 `workflowFile` 或直接传 `workflow`。
2) Runner 启动带扩展的 Chromium，输出导航/控制台日志到 SSE。
3) Runner 打开 `execute.html`，向扩展 background 发送 `workflow:execute` 消息并立即关闭该页。
4) 扩展后台在 offscreen/service worker 环境执行工作流，与目标页面交互。
5) Runner 等待一段时间（可配置 `timeoutMs`）后关闭浏览器上下文。

安装与启动
1) 进入 Runner 目录并安装依赖（pnpm）
   - `cd runner`
   - `pnpm install`
   - `pnpm run playwright:install`
2) 确认扩展已构建（仓库根目录需有 `build/manifest.json`）
   - 在仓库根：`pnpm run build`
3) 启动 Runner（默认端口 3100）
   - `pnpm run dev`
4) 打开 Demo 页面
   - http://localhost:3100/demo

API 说明
- POST `/api/runs`
  - 参数（任选其一）
    - `{ "workflowFile": "baidu-search.json" }`
    - `{ "workflow": { "name": "...", "drawflow": {...} }, "variables": { "k": "v" }, "timeoutMs": 120000 }`
  - 返回：`{ runId }`

- GET `/api/runs/:runId`
  - 返回：`{ status, createdAt, endedAt?, logs: [] }`

- GET `/api/runs/:runId/stream`（SSE）
  - 实时推送日志：`{ ts, type, text }`

