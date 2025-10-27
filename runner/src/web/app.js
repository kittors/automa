import express from 'express';
import path from 'path';
import { nanoid } from 'nanoid';
import { publicDir, workflowsDir, PORT } from './config.js';
import { readJSON, now } from '../core/utils.js';
import { runWorkflow } from '../core/run.js';
import { initRun, getRun, pushLog, addListener, removeListener } from '../core/store.js';

export function createApp() {
  // Web 层仅负责：
  // - 提供静态页面（demo.html / bridge.html）
  // - 提供简单 API（启动运行 / 查询状态 / 日志流）
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(publicDir));

  // Demo 页面，演示一键触发
  app.get('/demo', (req, res) => {
    res.sendFile(path.join(publicDir, 'demo.html'));
  });
  app.get('/', (req, res) => res.redirect('/demo'));

  // 启动一次运行
  app.post('/api/runs', async (req, res) => {
    try {
      const { workflowFile, workflow, variables, timeoutMs } = req.body || {};
      let wf = workflow;
      if (!wf && workflowFile) {
        const p = path.join(workflowsDir, workflowFile);
        if (!p || !p.endsWith('.json'))
          return res.status(400).json({ error: 'Invalid workflow file' });
        try {
          wf = readJSON(p);
        } catch (e) {
          return res.status(400).json({ error: 'workflowFile not found' });
        }
      }
      if (!wf) return res.status(400).json({ error: 'Missing workflow or workflowFile' });

      const runId = nanoid(10);
      const state = initRun(runId);

      const log = (entry) => pushLog(runId, entry);

      // 后台异步执行，立即返回 runId 给前端
      (async () => {
        try {
          state.status = 'running';
          pushLog(runId, {
            type: 'info',
            text: 'Launching Chromium and loading extension...',
            ts: now(),
          });
          await runWorkflow({ workflow: wf, variables, timeoutMs, log });
          state.status = 'succeeded';
          state.endedAt = now();
          pushLog(runId, { type: 'end', text: 'Run finished', ts: now() });
        } catch (err) {
          state.status = 'failed';
          state.error = String(err?.message || err);
          state.endedAt = now();
          pushLog(runId, { type: 'error', text: state.error, ts: now() });
        }
      })();

      return res.json({ runId });
    } catch (e) {
      return res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // 查询单次运行的状态
  app.get('/api/runs/:id', (req, res) => {
    const s = getRun(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    res.json(s);
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
    for (const l of s.logs) res.write(`data: ${JSON.stringify(l)}\n\n`);
    // 心跳包，保持连接活跃
    const ping = setInterval(() => {
      res.write(`data: ${JSON.stringify({ ts: now(), type: 'ping', text: '' })}\n\n`);
    }, 15000);
    req.on('close', () => {
      clearInterval(ping);
      removeListener(runId, res);
    });
  });

  return app;
}
