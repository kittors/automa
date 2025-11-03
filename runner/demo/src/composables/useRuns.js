import { ref, onMounted, onBeforeUnmount } from 'vue';
import { http, openSse } from '../utils/http.js';

export function useRuns() {
  const runs = ref([]);
  const loading = ref(false);
  const error = ref('');
  const connected = ref(false);
  const es = ref(null);

  function openStream() {
    try { if (es.value) es.value.close(); } catch (_) {}
    loading.value = true; error.value = '';
    es.value = openSse('/api/runs/stream', {
      onData: (payload) => {
        if (payload && payload.type === 'ping') return;
        const items = payload && payload.items ? payload.items : [];
        runs.value = Array.isArray(items) ? items : [];
        connected.value = true; loading.value = false;
      },
      onError: () => {
        connected.value = false; loading.value = false;
        setTimeout(() => openStream(), 1000);
      },
    });
  }

  async function stopRun(id) {
    try {
      const resp = await http.post(`/api/runs/${id}/stop`);
      return resp && resp.code === 200;
    } catch (e) {
      return false;
    }
  }

  onMounted(() => openStream());
  onBeforeUnmount(() => { try { if (es.value) es.value.close(); } catch (_) {} });

  return { runs, loading, error, connected, stopRun };
}
