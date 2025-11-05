# 部署（Docker & Docker Compose）

本目录提供两种部署方式：
- 基于源码本地构建镜像（docker compose）
- 直接使用 GitHub 容器镜像（GHCR）部署

两种方式均依赖扩展已构建产物（仓库根目录 `build/`）。

---

## 前置要求
- 已在仓库根构建扩展：执行一次 `pnpm run build`，确保存在 `build/manifest.json`。
- 已安装 Docker（推荐 24+）与 Docker Compose v2。
- 运行时环境变量默认读取 `runner/.env`（可复制并按需修改）。

目录映射（两种方式相同）：
- `../build -> /app/build`（只读）：扩展打包目录（Runner 从此处加载扩展）
- `../runner/.profile -> /app/runner/.profile`：Playwright 用户目录（持久化，提升稳定性）
- `../runner/workflows -> /app/runner/workflows`：工作流文件
- `../runner/public -> /app/runner/public`：演示页面与桥接页

---

## 方式一：基于源码构建（本地）
文件：`deploy/docker-compose.source.yml`

- 启动（首次会构建镜像）：
  - `docker compose -f deploy/docker-compose.source.yml up -d --build`
- 查看日志：
  - `docker compose -f deploy/docker-compose.source.yml logs -f`
- 访问：
  - 应用页：http://localhost:3100/app
  - 健康检查：http://localhost:3100/health
- 修改端口：
  - 编辑 `runner/.env` 的 `PORT=3200`，重新执行 up；或临时 `PORT=3200 docker compose -f deploy/docker-compose.source.yml up -d`。
- 升级代码：
  - `git pull && pnpm run build && docker compose -f deploy/docker-compose.source.yml up -d --build`

---

## 方式二：使用 GitHub 容器镜像（GHCR）
文件：`deploy/docker-compose.image.yml`

- 项目使用固定镜像：`ghcr.io/kittors/automa-runner:sha-f40a5fd`
- 可选：设置镜像名（二选一）用于覆盖默认值：
  - 在 `deploy/.env` 中设置：`RUNNER_IMAGE=ghcr.io/kittors/automa-runner:sha-f40a5fd`
  - 或在命令行导出：`export RUNNER_IMAGE=ghcr.io/kittors/automa-runner:sha-f40a5fd`
- 如镜像为私有，需要先登录 GHCR：
  - `echo <YOUR_GH_TOKEN> | docker login ghcr.io -u <YOUR_GH_USERNAME> --password-stdin`
- 启动：
  - `docker compose -f deploy/docker-compose.image.yml up -d`
- 拉取更新：
  - `docker compose -f deploy/docker-compose.image.yml pull && docker compose -f deploy/docker-compose.image.yml up -d`
- 访问与日志同上。

说明：仓库已提供 CI（`.github/workflows/runner-release.yml`）推送镜像至 `ghcr.io/kittors/automa-runner`，本项目部署固定使用 `sha-f40a5fd` 标签。

---

## 离线部署（无法连接 GitHub/外网）
当目标环境无法直接访问 GitHub/GHCR 时，可通过以下任一方式准备镜像并离线部署。

方式 A：从联网机器获取离线镜像（推荐）
- 在一台可联网的机器，前往仓库 GitHub Releases 页面，下载与你架构匹配的压缩包：
  - `automa-runner-amd64.tar.gz`（x86_64/amd64）
  - `automa-runner-arm64.tar.gz`（ARM64/aarch64）
- 若看到分卷文件（如 `.tar.gz.part00`、`.part01` ...），先合并：
  - `cat automa-runner-*.tar.gz.part* > automa-runner.tar.gz`
- 将文件拷贝到目标离线机器（U 盘/内网共享等），然后加载：
  - `gunzip -c automa-runner.tar.gz | docker load`
- 查看镜像：`docker images`（记下加载出来的镜像名与标签）
- 可选：重打标签（统一使用本地标签）：
  - `docker tag <LOADED_IMAGE:TAG> automa-runner:latest`
- 设置 `RUNNER_IMAGE` 指向本地标签（两选一）：
  - 在 `deploy/.env` 设置：`RUNNER_IMAGE=automa-runner:latest`
  - 或命令行：`export RUNNER_IMAGE=automa-runner:latest`
- 启动：
  - `docker compose -f deploy/docker-compose.image.yml up -d`

方式 B：从已拉取镜像的机器导出
- 在一台已联网且已拉取过镜像的机器：
  - `docker pull ghcr.io/kittors/automa-runner:sha-f40a5fd`
  - `docker save ghcr.io/kittors/automa-runner:sha-f40a5fd -o automa-runner.tar`
  - `gzip -9 automa-runner.tar`
- 将 `automa-runner.tar.gz` 传输至离线机器，加载：
  - `gunzip -c automa-runner.tar.gz | docker load`
- 之后步骤与“方式 A”相同。

注意事项（离线）：
- `deploy/docker-compose.image.yml` 使用 `pull_policy: if_not_present`，只在本地找不到镜像时才尝试拉取；离线场景下请确保已先执行 `docker load`。
- 如需完全禁止拉取，可临时将 compose 中 `pull_policy` 改成 `never`。
- 同步准备扩展产物：在仓库根执行 `pnpm run build`，并将 `build/` 与 `runner/` 一并放置到离线服务器同一目录结构下（保持映射路径有效）。

---

## 环境变量（常用）
- 在 `runner/.env` 中配置；compose 会以 `env_file` 注入容器。空值不会被默认值覆盖。
- 关键项：
  - `HOST`（默认 `0.0.0.0`）
  - `PORT`（默认 `3100`）
  - `OPEN_BRIDGE`（默认 `true`）
  - `HEADLESS`（默认 `false`，容器内由 Xvfb 提供显示）
  - `PROFILE_MODE`：`shared | per-run`（默认 `shared`）
  - `PERSIST_RUN_PROFILE`：`true | false`（默认 `false`）
  - `PW_DEBUG`：Playwright 调试日志（如 `pw:api`；留空关闭）
  - `NO_SANDBOX`：容器内以 root 运行 Chromium 时设为 `true`

---

## 常见问题
- `build/manifest.json: missing`
  - 需要在仓库根执行 `pnpm run build`，并确保 `../build` 已挂载到容器 `/app/build`。
- 端口占用或无法访问
  - 修改 `runner/.env` 的 `PORT` 并重新 `up -d`；或检查宿主机端口占用。
- 并发运行报错（用户目录冲突）
  - 将 `PROFILE_MODE=per-run`（支持并发），或等待当前运行结束（默认 `shared` 模式禁止并发）。

---

## 参考
- 源码目录：`runner/`
- 现有 compose（runner 目录内）：`runner/docker-compose.yml`
- CI 发布：`.github/workflows/runner-release.yml`
