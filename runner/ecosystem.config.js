/*
 * PM2 进程配置
 * 用法：
 *  1) 在仓库根构建扩展：pnpm run build
 *  2) 安装依赖：cd runner && pnpm i && pnpm run playwright:install
 *  3) 启动：cd runner && pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'automa-runner',
      cwd: __dirname,
      script: 'src/server.js',
      interpreter: 'node',
      exec_mode: 'fork', // 单实例即可，如果要多实例需注意用户目录隔离
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3100,
        OPEN_BRIDGE: process.env.OPEN_BRIDGE || 'true',
        HEADLESS: process.env.HEADLESS || 'false',
        PROFILE_MODE: process.env.PROFILE_MODE || 'shared',
        PERSIST_RUN_PROFILE: process.env.PERSIST_RUN_PROFILE || 'false',
      },
      // 日志：输出到 runner/.tmp 下，便于清理
      out_file: '.tmp/pm2-out.log',
      error_file: '.tmp/pm2-error.log',
      time: true,
    },
  ],
};
