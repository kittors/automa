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
