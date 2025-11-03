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

运行时环境变量
- `PORT`：服务端口（默认 3100）。
- `OPEN_BRIDGE`：是否在运行期间自动打开 `bridge.html` 作为“用户页签”（默认 true）。设为 `false` 可禁用，以避免产生 `GET /bridge.html` 访问日志。
- `HEADLESS`：是否以无头模式启动 Chromium（默认 false）。在服务器环境可设为 `true`。
- `PROFILE_MODE`：用户目录模式，`shared`（默认）或 `per-run`。`shared` 性能稍好但禁止并发（第二次调用会返回 409 busy）；`per-run` 为每次运行创建独立目录，允许并发执行。
- `PERSIST_RUN_PROFILE`：配合 `PROFILE_MODE=per-run` 使用，设为 `true` 时保留每次运行的用户目录（便于定位问题），默认不保留。

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
  - 健康检查：`http://localhost:3100/health`（返回 JSON，包含目录与扩展是否就绪）
  - 或调用：
    - `curl -X POST http://localhost:3100/api/runs -H 'Content-Type: application/json' -d '{ "workflowFile": "baidu-search.json" }'`

- 说明
  - 镜像基于 Playwright 官方镜像构建，并以 `xvfb-run` 方式启动，以便容器中可运行“非无头”模式的 Chromium（无需外接显示）。
  - 在容器内浏览器访问 `localhost:<PORT>` 即访问 Runner 自身，因此 `bridge.html` 可正常打开。
  - 访问根路径 `http://localhost:<PORT>` 会跳转到 `/demo`，若服务未启动或网络不通会在浏览器看到连接失败；此时请查看容器日志：`docker compose logs -f`。
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

PM2 部署
- 适用场景
  - 不使用 Docker，在物理机/虚拟机上以 Node.js 方式常驻运行。

- 前置要求
  - Node.js v18+（建议使用 nvm 安装与切换）
  - pnpm（`npm i -g pnpm`）
  - PM2（`npm i -g pm2` 或 `pnpm dlx pm2 -v` 验证）

- 一次性准备
  1) 在仓库根构建扩展（确保存在 `build/manifest.json`）
     - `pnpm run build`
  2) 安装 Runner 依赖并安装浏览器
     - `cd runner && pnpm i && pnpm run playwright:install`

- 启动与管理
  - 在 `runner` 目录：
    - 启动：`pm2 start ecosystem.config.js`
    - 指定端口：`PORT=3200 pm2 start ecosystem.config.js`（覆盖默认 3100）
    - 查看状态：`pm2 status`
    - 查看日志：`pm2 logs automa-runner --lines 100`
    - 健康检查：浏览器打开 `http://localhost:3100/health` 或 `curl http://localhost:3100/health`
    - 重启：`pm2 restart automa-runner`
    - 热重载（零停机）：`pm2 reload automa-runner`
  - 非在 `runner` 目录也可启动：`pm2 start runner/ecosystem.config.js`

- 开机自启
  - `pm2 startup` 按提示执行生成的命令
  - `pm2 save` 保存当前进程列表

- 日志位置
  - 标准输出：`runner/.tmp/pm2-out.log`
  - 错误输出：`runner/.tmp/pm2-error.log`

- 升级流程（拉新代码）
  1) `git pull`（在仓库根）
  2) `cd runner && pnpm i`（如依赖有变更）
  3) `pnpm run build`（如扩展源码有变更）
  4) `pm2 reload automa-runner`

- 多实例注意
  - 默认使用单实例（`instances: 1`）。如需多实例，请为每个实例提供独立的用户数据目录（`.profile`），否则 Chromium 的持久化目录会冲突。

故障排查（Debug）
- 如何确认服务已启动？
  - 浏览器打开：`http://localhost:3100/health`（应返回 JSON 且 `ok: true`）。
  - 访问根路径会跳转到 `/demo`：`http://localhost:3100/`。
  - 启动日志会打印完整配置信息（端口、目录、扩展 manifest 状态、Playwright 版本等）。
- Docker 模式
  - 查看日志：`docker compose logs -f`。
  - 健康状态：镜像内置 `HEALTHCHECK`，`docker ps` 中的 `STATUS` 应为 `healthy`。
  - 常见问题：
    - `ERR_CONNECTION_RESET`：容器未正常启动或端口未映射，查看日志/检查 3100 端口占用。
    - `build/manifest.json: missing`：需要在仓库根先执行 `pnpm run build` 生成扩展包，并确保 `../build` 正确挂载。
    - `Failed to create a ProcessSingleton for your profile directory`：同一用户目录被并发占用。使用 `PROFILE_MODE=per-run` 开启并发，或等待当前运行结束（默认 `shared` 模式下禁止并发）。
- PM2 模式
  - 查看日志：`pm2 logs automa-runner --lines 200`。
  - 端口占用：修改端口 `PORT=3200 pm2 restart automa-runner`，或释放占用端口。
