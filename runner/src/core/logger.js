// 简单彩色日志工具，集中管理颜色与格式，避免在各处散落转义常量

export const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blueBright: '\x1b[94m',
  dim: '\x1b[2m',
};

function wrap(color, text) {
  return `${color}${text}${colors.reset}`;
}

export const logger = {
  info: (msg) => console.log(wrap(colors.green, msg)),
  warn: (msg) => console.log(wrap(colors.yellow, msg)),
  error: (msg, err) => {
    if (err) console.error(wrap(colors.red, msg), err);
    else console.error(wrap(colors.red, msg));
  },
  link: (msg) => console.log(wrap(colors.blueBright, msg)),
  dim: (msg) => console.log(wrap(colors.dim, msg)),
};

export function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const code = res.statusCode || 0;
      const url = req.originalUrl || req.url || '';
      const isLink = url === '/demo' || url === '/health' || url === '/api/health';
      let color = colors.green;
      if (code >= 500) color = colors.red;
      else if (code >= 400) color = colors.yellow;
      else if (code >= 300) color = colors.blueBright;
      if (isLink) color = colors.blueBright; // 指定链接使用亮蓝色
      console.log(wrap(color, `[web] ${req.method} ${url} -> ${code} ${ms}ms`));
    });
    next();
  };
}

export function printStartupBanner({
  startedAt,
  node,
  platform,
  arch,
  playwright,
  port,
  runnerRoot,
  publicDir,
  workflowsDir,
  buildDir,
  buildReady,
  options, // string
}) {
  console.log(wrap(colors.green, '[runner] =============================================='));
  console.log(wrap(colors.green, `[runner] started at: ${startedAt.toISOString()}`));
  console.log(wrap(colors.green, `[runner] node: ${node} | platform: ${platform} ${arch}`));
  console.log(wrap(colors.green, `[runner] playwright: ${playwright || '<unknown>'}`));
  console.log(wrap(colors.green, `[runner] port: ${port}`));
  console.log(wrap(colors.green, `[runner] runnerRoot: ${runnerRoot}`));
  console.log(wrap(colors.green, `[runner] publicDir: ${publicDir}`));
  console.log(wrap(colors.green, `[runner] workflowsDir: ${workflowsDir}`));
  console.log(wrap(colors.green, `[runner] buildDir: ${buildDir}`));
  console.log(wrap(colors.green, `[runner] options: ${options}`));
  console.log(wrap(buildReady ? colors.green : colors.red, `[runner] build/manifest.json: ${buildReady ? 'found' : 'missing'}`));
  console.log(wrap(colors.blueBright, `[runner] health: http://localhost:${port}/health`));
  console.log(wrap(colors.blueBright, `[runner] demo:   http://localhost:${port}/demo`));
  console.log(wrap(colors.green, '[runner] =============================================='));
}

// 将 SSE 的日志以彩色输出到终端
export function printSseEntry(runId, entry) {
  if (!entry || entry.type === 'ping') return; // 忽略心跳
  const type = String(entry.type);
  const ts = entry.ts || new Date().toISOString();
  const text = entry.text || '';
  let color = colors.green; // 默认作为“正常日志”
  if (type === 'warn') color = colors.yellow;
  if (type === 'error' || type === 'pageerror' || type === 'requestfailed') color = colors.red;
  if (type === 'trace' || type === 'console') color = colors.dim;
  const prefix = wrap(colors.dim, `[run:${runId}]`);
  console.log(`${prefix} ${wrap(color, `[${ts}] ${type} - ${text}`)}`);
}

