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

```
runner/
├─ src/
│  ├─ server.js                仅负责创建目录、启动 Web 应用、监听端口
│  ├─ web/
│  │  ├─ config.js             路径与常量（PORT、publicDir、workflowsDir、buildDir）
│  │  └─ app.js                Express 应用；静态页面与 API（POST /api/runs、GET /api/runs/:id、SSE /api/runs/:id/stream）
│  └─ core/
│     ├─ run.js                组合整体运行流程（启动上下文 → 解析扩展 ID → 关闭欢迎页 → 触发执行 → 等待 → 关闭）
│     ├─ browser.js            浏览器与扩展相关工具（启动、日志绑定、扩展 ID 查找、关闭欢迎页、打开 bridge）
│     ├─ trigger.js            触发执行的最小实现（execute.html + runtime 消息）
│     ├─ store.js              一次运行的内存态与 SSE 订阅
│     └─ utils.js              通用函数（now/delay/readJSON）
├─ public/
│  ├─ demo.html                演示页面（点击按钮 → 调用 API → 显示实时日志）
│  └─ bridge.html              普通 http 页面（保持一个用户页签，无逻辑要求）
└─ workflows/
   └─ *.json                   工作流文件示例（默认 baidu-search.json）
```

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

Docker 部署
- 前置要求
  - 已构建扩展：仓库根目录存在 `build/manifest.json`（在仓库根运行一次 `pnpm run build`）。
  - 安装 Docker（24+）与 Docker Compose（v2）。

- 快速启动（docker compose）
  - 进入 `runner` 目录，直接启动：
    - `docker compose up -d`
  - 默认映射端口 `3100`，可通过环境变量覆盖：
    - `PORT=3200 docker compose up -d`

- 卷与映射说明（见 `runner/docker-compose.yml`）
  - `../build -> /app/build`（只读）：扩展打包目录，Runner 从此处加载扩展。
  - `./.profile -> /app/runner/.profile`：持久化用户目录，保证浏览器稳定与避免首次启动提示。
  - `./workflows -> /app/runner/workflows`：工作流文件（在容器内通过文件名引用）。
  - `./public -> /app/runner/public`：演示页面与桥接页。

- 验证
  - 打开：`http://localhost:3100/demo`
  - 或调用：
    - `curl -X POST http://localhost:3100/api/runs -H 'Content-Type: application/json' -d '{ "workflowFile": "baidu-search.json" }'`

- 说明
  - 镜像基于 Playwright 官方镜像构建，并以 `xvfb-run` 方式启动，以便容器中可运行“非无头”模式的 Chromium（无需外接显示）。
  - 在容器内浏览器访问 `localhost:<PORT>` 即访问 Runner 自身，因此 `bridge.html` 可正常打开。
  - 组合默认以 root 运行（compose 中设置 `user: 0:0`），以避免将宿主机目录挂载到容器时的权限问题；如要降权运行，请将 `.profile` 改为命名卷，或调整宿主机目录权限。

CI/发布（自动构建多架构镜像）
- 触发条件
  - 向 `prod` 分支推送代码时：
    - 构建并推送多架构镜像到 GHCR：`ghcr.io/<OWNER>/automa-runner:{latest,prod,sha}`。
    - 生成 Release，并附带离线镜像压缩包：
      - `automa-runner-amd64.tar`（x86_64）
      - `automa-runner-arm64.tar`（arm64）

- 工作流文件
  - `.github/workflows/runner-release.yml`
  - 主要步骤：Checkout → Buildx/QEMU → 登录 GHCR → 多架构构建并推送 → 打包单架构 tar → 创建 Release 并上传资产。

- 在线使用（外网可访问 GHCR）
  - 直接拉取：`docker pull ghcr.io/<OWNER>/automa-runner:latest`
  - 修改 `runner/docker-compose.yml` 中 `image` 为：`ghcr.io/<OWNER>/automa-runner:latest` 后 `docker compose up -d`。

- 离线/内网部署
  1) 从 Releases 下载与你架构匹配的 `automa-runner-*.tar`。
  2) 在目标机器加载镜像：
     - `docker load -i automa-runner-amd64.tar` 或 `docker load -i automa-runner-arm64.tar`
  3) 确认已存在 `build/manifest.json`，放置为容器可见路径（默认使用仓库根的 `build`，即与 `runner` 同级）。
  4) 在 `runner` 目录执行：`docker compose up -d`。
  - 说明：当前 `docker-compose.yml` 默认使用镜像标签 `automa-runner:latest`，加载 tar 后无需改动；若你自定义了标签，请同步修改 compose 中的 `image`。

支持的架构
- linux/amd64（x86_64）
- linux/arm64（aarch64，如 Apple Silicon、部分服务器）
