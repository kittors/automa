import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 路径/常量统一配置，方便在不同模块中复用
export const runnerRoot = path.resolve(__dirname, '..', '..'); // runner 根目录
export const repoRoot = path.resolve(runnerRoot, '..'); // 仓库根目录
export const workflowsDir = path.join(runnerRoot, 'workflows'); // 工作流文件目录
export const publicDir = path.join(runnerRoot, 'public'); // 静态文件目录（demo/bridge）
export const buildDir = path.join(repoRoot, 'build'); // 扩展打包目录
export const PORT = process.env.PORT ? Number(process.env.PORT) : 3100; // 服务端口
// 运行行为配置（可通过环境变量覆盖）
export const OPEN_BRIDGE = process.env.OPEN_BRIDGE ? process.env.OPEN_BRIDGE !== 'false' : true; // 是否打开 bridge 页面
export const HEADLESS = process.env.HEADLESS ? process.env.HEADLESS === 'true' : false; // 是否无头
export const PROFILE_MODE = process.env.PROFILE_MODE === 'per-run' ? 'per-run' : 'shared'; // 用户目录模式：shared(默认)/per-run
export const PERSIST_RUN_PROFILE = process.env.PERSIST_RUN_PROFILE === 'true'; // per-run 模式下是否保留用户目录
