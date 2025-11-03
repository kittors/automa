import { now } from './utils.js';

// 触发执行：打开扩展 execute.html 页面，向 background 发送 workflow:execute 消息
// 不写入 storage，不打开 dashboard/popup，执行后立即关闭该页
export async function triggerViaExecutePage(context, extId, workflowObj, variables, log) {
  const page = await context.newPage();
  const url = `chrome-extension://${extId}/execute.html`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    log({ type: 'warn', text: `Extension page load warning: ${e.message}`, ts: now() });
  }

  const wfToSend = { ...workflowObj };
  if (!wfToSend.id) wfToSend.id = `runner-${Date.now()}`;

  try {
    await page.waitForFunction(() => !!(window.chrome && chrome.runtime && chrome.runtime.id), {
      timeout: 5000,
    });
    const payload = { wf: wfToSend, vars: variables || {} };
    const ok = await page.evaluate((p) => {
      try {
        const { wf, vars } = p;
        const msg = {
          name: 'background--workflow:execute',
          data: { ...wf, options: { checkParams: false, data: { variables: vars } } },
        };
        if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(msg);
          // 观察 workflowStates 的变化并输出给控制台（由后端解析为 wfstate）
          try {
            const wfId = wf.id;
            function emit(state) {
              if (!state) return;
              const list = Array.isArray(state) ? state : Object.values(state);
              const item = (list || []).find((s) => s && (s.workflowId === wfId));
              if (!item) return;
              const current = (item.state && item.state.currentBlock && item.state.currentBlock[0]) || null;
              const payload = { status: item.state?.status || '', blocks: item.state?.currentBlock || [], current };
              // 特定前缀方便解析
              console.log('[RUNNER:STATE]' + JSON.stringify(payload));
            }
            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.get('workflowStates', ({ workflowStates }) => emit(workflowStates));
              chrome.storage.local.onChanged.addListener((changes) => {
                if (changes && changes.workflowStates) emit(changes.workflowStates.newValue);
              });
            }
          } catch (e) {}
          return true;
        }
        if (window.browser && browser.runtime && browser.runtime.sendMessage) {
          browser.runtime.sendMessage(msg);
          try {
            const wfId = wf.id;
            function emit(state) {
              if (!state) return;
              const list = Array.isArray(state) ? state : Object.values(state);
              const item = (list || []).find((s) => s && (s.workflowId === wfId));
              if (!item) return;
              const current = (item.state && item.state.currentBlock && item.state.currentBlock[0]) || null;
              const payload = { status: item.state?.status || '', blocks: item.state?.currentBlock || [], current };
              console.log('[RUNNER:STATE]' + JSON.stringify(payload));
            }
            if (browser.storage && browser.storage.local) {
              browser.storage.local.get('workflowStates').then(({ workflowStates }) => emit(workflowStates));
              browser.storage.local.onChanged.addListener((changes) => {
                if (changes && changes.workflowStates) emit(changes.workflowStates.newValue);
              });
            }
          } catch (e) {}
          return true;
        }
        return false;
      } catch (e) {
        return { error: String(e && e.message ? e.message : e) };
      }
    }, payload);
    if (ok && ok.error) log({ type: 'error', text: `Trigger error: ${ok.error}`, ts: now() });
    else log({ type: 'info', text: 'Triggered workflow via extension page', ts: now() });
  } finally {
    // 保持该页面打开，以便监听 workflowStates（关闭上下文时会自动关闭）
  }
}
