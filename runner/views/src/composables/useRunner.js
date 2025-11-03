import { ref } from 'vue';
import { http, openSse } from '../utils/http.js';

export function useRunner() {
  const logs = ref([]);
  const runId = ref('');
  const busy = ref(false);
  const es = ref(null);
  const workflows = ref([]);
  const selectedWf = ref('');
  const wfMeta = ref({ name: '', nodes: [] });
  const wfProgress = ref({ index: 0, states: [], status: 'idle' });
  const nodeDetails = ref({}); // id -> { status, startedAt, endedAt, logs: [] }

  function append(entry){
    logs.value.push(entry);
  }
  function clientLog(text, level='info'){
    append({ ts: new Date().toISOString(), type: level, text });
  }
  function stopStream(){ if(es.value){ es.value.close(); es.value = null; } }
  function clearLogs(){ logs.value = []; }
  function resetProgress(){
    const states = (wfMeta.value.nodes || []).map(()=>'pending');
    wfProgress.value = { index: 0, states, status: 'idle' };
    const map = {};
    (wfMeta.value.nodes || []).forEach(n => { map[n.id] = { status: 'pending', startedAt: '', endedAt: '', logs: [] }; });
    nodeDetails.value = map;
    // 暂存到全局，便于其他视图读取（后续可改为通过 store 注入）
    try { globalThis.__nodeDetails = nodeDetails.value; } catch(_) {}
  }

  async function loadWorkflows(){
    try{
      const resp = await http.get('/api/workflows');
      const items = (resp && resp.data && resp.data.items) || [];
      workflows.value = items.length ? items : [{ file: 'baidu-search.json', name: 'baidu-search.json' }];
      selectedWf.value = workflows.value[0]?.file || 'baidu-search.json';
    }catch(e){
      workflows.value = [{ file: 'baidu-search.json', name: 'baidu-search.json' }];
      selectedWf.value = 'baidu-search.json';
    }
  }

  async function start(){
    if (busy.value) return;
    busy.value = true; stopStream(); clearLogs(); runId.value='';
    try{
      const body = { workflowFile: selectedWf.value || 'baidu-search.json', finishPolicy: 'idle', idleMs: 3000, timeoutMs: 60000 };
      const resp = await http.post('/api/runs', body);
      if (!resp || resp.code !== 200 || !resp.data || !resp.data.runId) {
        clientLog(`[client] 请求失败：${resp?.msg || '未知错误'}`, 'warn');
        return;
      }
      runId.value = resp.data.runId;
      // 初始化进度
      resetProgress();
      const stream = openSse(`/api/runs/${resp.data.runId}/stream`, {
        onData: (m) => {
          if (!m || m.type === 'ping') return;
          // 实时状态（从扩展 storage.local）
          if (m.type === 'wfstate' && m.data) {
            if (!wfMeta.value || !Array.isArray(wfMeta.value.nodes)) return;
            const st = wfProgress.value.states.slice();
            const nodesArr = wfMeta.value.nodes || [];
            const startNodeAt = (i, startedAt) => {
              if (i < 0 || i >= st.length) return;
              if (st[i] === 'pending') st[i] = 'active';
              const id = nodesArr[i].id;
              const nd = nodeDetails.value[id];
              if (nd) {
                if (!nd.startedAt) nd.startedAt = startedAt || new Date().toISOString();
                nd.status = 'active';
                nd.logs.push({ ts: new Date().toISOString(), type: 'info', text: `开始执行: ${nodesArr[i].label}` });
              }
            };
            const finishNodeAt = (i) => {
              if (i < 0 || i >= st.length) return;
              if (st[i] !== 'error') st[i] = 'done';
              const id = nodesArr[i].id;
              const nd = nodeDetails.value[id];
              if (nd) {
                if (!nd.endedAt) nd.endedAt = new Date().toISOString();
                if (nd.status !== 'error') nd.status = 'done';
                nd.logs.push({ ts: new Date().toISOString(), type: 'info', text: `执行完成: ${nodesArr[i].label}` });
              }
            };

            const cur = m.data.current || null;
            if (cur) {
              const idx = nodesArr.findIndex((x) => x.id === cur.id || x.rawLabel === cur.name);
              if (idx >= 0) {
                const prev = wfProgress.value.index;
                if (prev !== idx && prev >= 0) finishNodeAt(prev);
                // 补齐之前所有节点为完成，避免漏推进
                for (let k = 0; k < idx; k++) finishNodeAt(k);
                startNodeAt(idx, cur.startedAt);
                wfProgress.value.index = idx;
              }
            }
            if (m.data.status === 'success' || m.data.status === 'succeeded') {
              for (let k = 0; k < st.length; k++) finishNodeAt(k);
              wfProgress.value.status = 'succeeded';
            } else if (m.data.status === 'error' || m.data.status === 'failed') {
              const i = Math.min(wfProgress.value.index, st.length - 1);
              if (i >= 0) {
                st[i] = 'error';
                const id = nodesArr[i].id;
                const nd = nodeDetails.value[id];
                if (nd) { nd.status = 'error'; nd.endedAt = new Date().toISOString(); nd.logs.push({ ts: new Date().toISOString(), type: 'error', text: `执行失败: ${nodesArr[i].label}` }); }
              }
              wfProgress.value.status = 'failed';
            } else {
              wfProgress.value.status = 'running';
            }
            wfProgress.value.states = st;
            return;
          }
          if (m.type === 'wfmeta' && m.meta) {
            wfMeta.value = m.meta;
            resetProgress();
            wfProgress.value.status = 'running';
            return;
          }
          append(m);
          const txt = String(m.text || '');
          // 仅处理停止/结束的收尾（错误由 wfstate 决定），避免误判
          if (wfProgress.value && Array.isArray(wfProgress.value.states) && wfProgress.value.states.length) {
            const st = wfProgress.value.states.slice();
            const stoppingHint = m.type === 'warn' && /(Run stopped by user|Stopping by user request)/i.test(txt);
            if (m.type === 'end') {
              // 将所有非错误节点标记完成，并写入详情的结束时间
              for (let k = 0; k < st.length; k++) {
                if (st[k] !== 'error') st[k] = 'done';
                const nodesArr = wfMeta.value.nodes || [];
                const id = (nodesArr[k] && nodesArr[k].id) || '';
                const nd = nodeDetails.value[id];
                if (nd) {
                  if (!nd.endedAt) nd.endedAt = new Date().toISOString();
                  if (nd.status !== 'error') nd.status = 'done';
                  // 若该节点此前没有任何日志，补充一个完成记录
                  const label = (nodesArr[k] && nodesArr[k].label) || '';
                  nd.logs = Array.isArray(nd.logs) ? nd.logs : [];
                  const hasFinish = nd.logs.some((x) => /执行完成/.test(x.text || ''));
                  if (!hasFinish) nd.logs.push({ ts: new Date().toISOString(), type: 'info', text: `执行完成: ${label}` });
                }
              }
              wfProgress.value.status = 'succeeded';
            } else if (stoppingHint) {
              wfProgress.value.status = 'stopped';
            }
            wfProgress.value.states = st;
          }
          const stoppingHint = m.type === 'warn' && /(Run stopped by user|Stopping by user request)/i.test(txt);
          if (m.type === 'end' || m.type === 'error' || stoppingHint) {
            stopStream();
            busy.value = false;
            if (stoppingHint) wfProgress.value.status = 'stopped';
          }
        },
        onError: () => { clientLog('[client] 日志流连接中断', 'warn'); stopStream(); busy.value = false; },
      });
      es.value = stream;
    }catch(err){
      const msg = err && err.msg ? err.msg : (err && err.message) ? err.message : err;
      clientLog('[client] 异常：' + msg, 'error');
    } finally {
      if(!es.value) busy.value = false;
    }
  }

  return { logs, runId, busy, es, workflows, selectedWf, loadWorkflows, start, clearLogs, stopStream, wfMeta, wfProgress, nodeDetails };
}
