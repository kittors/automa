import express from 'express';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { publicDir, workflowsDir, PORT, buildDir, PROFILE_MODE, repoRoot } from './config.js';
import { readJSON, now } from '../core/utils.js';
import { runWorkflow } from '../core/run.js';
import { initRun, getRun, pushLog, addListener, removeListener, listRuns, setRuntime, getRuntime, clearRuntime, addRunsListener, removeRunsListener, notifyRunsChanged } from '../core/store.js';
import { requestLogger } from '../core/logger.js';
// 延迟读取中文块名称表，避免 ESM JSON import 兼容性问题
let __zhBlocks = null;
function getZhBlocks() {
  if (__zhBlocks) return __zhBlocks;
  try {
    const p = path.join(repoRoot, 'src', 'locales', 'zh', 'blocks.json');
    if (fs.existsSync(p)) __zhBlocks = JSON.parse(fs.readFileSync(p, 'utf8'));
    else __zhBlocks = {};
  } catch (_) {
    __zhBlocks = {};
  }
  return __zhBlocks;
}

export function createApp() {
  // Web 层仅负责：
  // - 提供静态页面（demo 构建产物 / bridge.html）
  // - 提供简单 API（启动运行 / 查询状态 / 日志流）
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(requestLogger());
  app.use(express.static(publicDir));

  // 根路径的展示在 server.js 中统一处理（服务运行状态页）

  // 健康检查与运行状态
  const healthHandler = (req, res) => {
    const manifest = path.join(buildDir, 'manifest.json');
    const hasManifest = fs.existsSync(manifest);
    ok(res, {
      port: PORT,
      publicDir,
      workflowsDir,
      buildDir,
      buildReady: hasManifest,
      ts: now(),
    });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // 列出历史运行；支持 ?status=running 过滤
  app.get('/api/runs', (req, res) => {
    const status = String(req.query.status || '').trim() || undefined;
    ok(res, { items: listRuns({ status }) });
  });

  // 列出可用的工作流文件（workflowsDir 下的 .json）
  app.get('/api/workflows', (req, res) => {
    try {
      if (!fs.existsSync(workflowsDir)) return ok(res, { items: [] });
      const files = fs
        .readdirSync(workflowsDir, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith('.json'))
        .map((d) => d.name)
        .sort();
      const items = files.map((file) => {
        let name = '';
        try {
          const p = path.join(workflowsDir, file);
          const j = readJSON(p);
          if (j && typeof j.name === 'string') name = j.name;
        } catch (_) {}
        return { file, name: name || file };
      });
      ok(res, { items });
    } catch (e) {
      err(res, 500, String(e?.message || e));
    }
  });

  // 启动一次运行
  app.post('/api/runs', async (req, res) => {
    try {
      const { workflowFile, workflow, variables, timeoutMs, finishPolicy, idleMs } = req.body || {};
      // 共享用户目录模式下的并发锁
      if (PROFILE_MODE === 'shared' && sharedProfileLock) {
        return err(res, 409, 'Runner busy: another run is using the shared profile. Set PROFILE_MODE=per-run to allow concurrent runs.');
      }
      let wf = workflow;
      if (!wf && workflowFile) {
        const p = path.join(workflowsDir, workflowFile);
        if (!p || !p.endsWith('.json'))
          return err(res, 400, 'Invalid workflow file');
        try {
          wf = readJSON(p);
        } catch (e) {
          return err(res, 400, 'workflowFile not found');
        }
      }
      if (!wf) return err(res, 400, 'Missing workflow or workflowFile');

      const runId = nanoid(10);
      const state = initRun(runId);
      notifyRunsChanged();
      if (wf && wf.name) state.workflowName = wf.name;
      else if (workflowFile) state.workflowName = workflowFile;

      // 推送一次工作流元信息，便于前端展示节点进度
      try {
        const meta = buildWorkflowMeta(wf);
        state.workflowMeta = meta;
        pushLog(runId, { type: 'wfmeta', text: meta?.name || '', ts: now(), meta });
      } catch (_) {}

      const log = (entry) => pushLog(runId, entry);

      // 后台异步执行，立即返回 runId 给前端
      (async () => {
        try {
          if (PROFILE_MODE === 'shared') sharedProfileLock = true;
          state.status = 'running';
          notifyRunsChanged();
          pushLog(runId, {
            type: 'info',
            text: 'Launching Chromium and loading extension...',
            ts: now(),
          });
          await runWorkflow({
            runId,
            workflow: wf,
            variables,
            timeoutMs,
            finishPolicy,
            idleMs,
            log,
            onContext: (context) => setRuntime(runId, { context, stopping: false }),
            onEnd: () => clearRuntime(runId),
          });
          const rtAfter = getRuntime(runId);
          state.endedAt = now();
          if (rtAfter && rtAfter.stopping) {
            state.status = 'stopped';
            pushLog(runId, { type: 'warn', text: 'Run stopped by user', ts: now() });
          } else {
            state.status = 'succeeded';
            pushLog(runId, { type: 'end', text: 'Run finished', ts: now() });
          }
          notifyRunsChanged();
        } catch (err) {
          const rt = getRuntime(runId);
          state.endedAt = now();
          if (rt && rt.stopping) {
            state.status = 'stopped';
            pushLog(runId, { type: 'warn', text: 'Run stopped by user', ts: now() });
          } else {
            state.status = 'failed';
            state.error = String(err?.message || err);
            pushLog(runId, { type: 'error', text: state.error, ts: now() });
          }
          notifyRunsChanged();
        } finally {
          if (PROFILE_MODE === 'shared') sharedProfileLock = false;
          clearRuntime(runId);
        }
      })();

      return ok(res, { runId });
    } catch (e) {
      return err(res, 500, String(e?.message || e));
    }
  });

  // 运行列表实时 SSE（要放在 /api/runs/:id 之前，避免被 :id 匹配）
  app.get('/api/runs/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    addRunsListener(res);
    // 先推送一次当前列表
    res.write(`data: ${JSON.stringify({ code: 200, msg: '', data: { items: listRuns() } })}\n\n`);
    const ping = setInterval(() => {
      res.write(`data: ${JSON.stringify({ code: 200, msg: '', data: { type: 'ping', ts: now() } })}\n\n`);
    }, 15000);
    req.on('close', () => {
      clearInterval(ping);
      removeRunsListener(res);
    });
  });

  // 查询单次运行的状态
  app.get('/api/runs/:id', (req, res) => {
    const s = getRun(req.params.id);
    if (!s) return err(res, 404, 'not found');
    ok(res, s);
  });

  

  // 手动停止运行
  app.post('/api/runs/:id/stop', async (req, res) => {
    const runId = req.params.id;
    const s = getRun(runId);
    if (!s) return err(res, 404, 'not found');
    if (s.status !== 'running') return err(res, 400, 'not running');
    const rt = getRuntime(runId);
    if (!rt || !rt.context) return err(res, 409, 'runtime-not-ready');
    try {
      rt.stopping = true;
      s.status = 'stopping';
      s.endedAt = undefined;
      notifyRunsChanged();
      pushLog(runId, { type: 'warn', text: 'Stopping by user request…', ts: now() });
      await rt.context.close().catch(() => {});
      // 释放共享模式的并发锁，避免长时间阻塞后续任务
      if (PROFILE_MODE === 'shared') sharedProfileLock = false;
      notifyRunsChanged();
      return ok(res, { ok: true });
    } catch (e) {
      return err(res, 500, String(e?.message || e));
    }
  });

  // 日志实时流（SSE）
  app.get('/api/runs/:id/stream', (req, res) => {
    const runId = req.params.id;
    const s = getRun(runId);
    if (!s) return res.status(404).end();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    addListener(runId, res);
    for (const l of s.logs) res.write(`data: ${JSON.stringify({ code: 200, msg: '', data: l })}\n\n`);
    // 心跳包，保持连接活跃
    const ping = setInterval(() => {
      res.write(`data: ${JSON.stringify({ code: 200, msg: '', data: { ts: now(), type: 'ping', text: '' } })}\n\n`);
    }, 15000);
    req.on('close', () => {
      clearInterval(ping);
      removeListener(runId, res);
    });
  });

  return app;
}

// 模块级并发锁（shared profile 模式下生效）
let sharedProfileLock = false;

// 从 workflow JSON 中提取简化元信息（名称 + 有序节点列表）
function buildWorkflowMeta(wf) {
  if (!wf || !wf.drawflow) return { name: wf?.name || '', nodes: [] };
  const edges = Array.isArray(wf.drawflow.edges) ? wf.drawflow.edges : [];
  const nodes = Array.isArray(wf.drawflow.nodes) ? wf.drawflow.nodes : [];
  const idToNode = new Map();
  nodes.forEach((n) => idToNode.set(n.id, n));
  // 计算入度
  const indeg = new Map();
  nodes.forEach((n) => indeg.set(n.id, 0));
  edges.forEach((e) => {
    if (idToNode.has(e.target)) indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  });
  // Kahn 拓扑排序（若图不完整则退化为原顺序）
  const q = [];
  for (const [id, d] of indeg) if (d === 0) q.push(id);
  const ordered = [];
  const outAdj = new Map();
  edges.forEach((e) => {
    if (!outAdj.has(e.source)) outAdj.set(e.source, []);
    outAdj.get(e.source).push(e.target);
  });
  while (q.length) {
    const id = q.shift();
    if (idToNode.has(id)) ordered.push(id);
    const outs = outAdj.get(id) || [];
    for (const t of outs) {
      const d = (indeg.get(t) || 0) - 1;
      indeg.set(t, d);
      if (d === 0) q.push(t);
    }
  }
  // 若排序数量不足，补齐剩余节点
  if (ordered.length < nodes.length) {
    const rest = nodes.map((n) => n.id).filter((id) => !ordered.includes(id));
    ordered.push(...rest);
  }
  const metaNodes = ordered.map((id) => {
    const n = idToNode.get(id) || {};
    const key = n.label || n.type || 'node';
    // 翻译成中文名称（fallback 到英文 key）
    const zh = getZhBlocks();
    const cn = zh?.workflow?.blocks?.[key]?.name || key;
    const desc = (n.data && (n.data.description || n.data.name)) || '';
    return { id, label: cn, rawLabel: key, desc };
  });
  return { name: wf.name || '', nodes: metaNodes };
}
  // 统一响应封装
  function ok(res, data = null, code = 200, msg = '') { res.status(code).json({ code, msg, data }); }
  function err(res, code = 500, msg = 'Internal Error', data = null) { res.status(code).json({ code, msg, data }); }
