import { ref } from 'vue';
import { http, openSse } from '../utils/http.js';

export function useRunner() {
  const logs = ref([]);
  const runId = ref('');
  const busy = ref(false);
  const es = ref(null);
  const workflows = ref([]);
  const selectedWf = ref('');

  function append(entry){
    logs.value.push(entry);
  }
  function clientLog(text, level='info'){
    append({ ts: new Date().toISOString(), type: level, text });
  }
  function stopStream(){ if(es.value){ es.value.close(); es.value = null; } }
  function clearLogs(){ logs.value = []; }

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
      const stream = openSse(`/api/runs/${resp.data.runId}/stream`, {
        onData: (m) => {
          if (!m || m.type === 'ping') return;
          append(m);
          const txt = String(m.text || '');
          const stoppingHint = m.type === 'warn' && /(Run stopped by user|Stopping by user request)/i.test(txt);
          if (m.type === 'end' || m.type === 'error' || stoppingHint) {
            stopStream();
            busy.value = false;
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

  return { logs, runId, busy, es, workflows, selectedWf, loadWorkflows, start, clearLogs, stopStream };
}
