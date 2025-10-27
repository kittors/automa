import fs from 'fs';

// 获取当前时间（ISO 字符串），用于统一日志时间戳
export function now() {
  return new Date().toISOString();
}

// 异步延迟（毫秒）
export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// 读取 JSON 文件（同步）
export function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
