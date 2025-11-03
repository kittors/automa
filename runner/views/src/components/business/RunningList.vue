<template>
  <section class="card running">
    <div class="header">
      <div class="title-wrap">
        <span class="dot" :class="{ on: activeRuns.length > 0 }"></span>
        <h3 class="title">运行中</h3>
        <span class="count" v-if="activeRuns.length">{{ activeRuns.length }}</span>
        <span class="live" :class="{ on: connected }">{{ connected ? '实时' : '连接中…' }}</span>
      </div>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-else-if="!activeRuns.length" class="empty">暂无运行中的任务</div>

    <ScrollArea v-else class="list-area">
      <ul class="list">
        <li v-for="r in activeRuns" :key="r.id" class="item">
          <div class="meta">
            <div class="name" :title="r.workflowName || r.id">{{ r.workflowName || r.id }}</div>
            <div class="sub">{{ r.id }} · {{ fmtTime(r.createdAt) }}</div>
          </div>
          <div class="actions">
            <span v-if="r.status === 'stopping'" class="badge muted">停止中…</span>
            <button v-else class="btn danger" @click="onStop(r.id)" :disabled="loading || r.status !== 'running'">停止</button>
          </div>
        </li>
      </ul>
    </ScrollArea>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useRuns } from '../../composables/useRuns.js';
import ScrollArea from '../ui/ScrollArea.vue';

const { runs, loading, error, connected, stopRun } = useRuns();
const activeRuns = computed(() => {
  const arr = Array.isArray(runs?.value) ? runs.value : [];
  return arr.filter((r) => r && (r.status === 'running' || r.status === 'stopping'));
});

function fmtTime(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleString(); } catch (_) { return s; }
}

async function onStop(id) {
  await stopRun(id);
}
</script>

<style scoped>
.running{ position: sticky; top: calc(var(--header-h) + 24px); }
.header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.title-wrap{ display:flex; align-items:center; gap:8px; }
.title{ margin:0; font-size:14px; font-weight:700; }
.count{ background: var(--c-primary-50); color: var(--c-blue); border: 1px solid var(--c-primary-100); padding: 0 8px; border-radius: 9999px; font-size: 12px; }
.dot{ width:8px; height:8px; border-radius:50%; background:#cbd5e1; }
.dot.on{ background:#22c55e; }
.live{ margin-left: 8px; font-size: 12px; color: var(--c-dim); }
.live.on{ color: #16a34a; }

.error{ color:#dc2626; font-size:12px; padding:6px 0; }
.empty{ color: var(--c-dim); font-size: 12px; padding: 8px 0; }

.list-area{ max-height: 420px; }
.list{ list-style:none; margin:0; padding:0; }
.item{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 8px; border-top:1px solid var(--c-border); }
.item:first-child{ border-top:none; }
.meta{ min-width:0; }
.name{ font-weight:600; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sub{ color: var(--c-dim); font-size: 12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.actions{ display:flex; align-items:center; gap:8px; }
.badge.muted{ background:#f3f4f6; border:1px solid #e5e7eb; color:#6b7280; padding:2px 8px; border-radius:9999px; font-size:12px; }
.btn.danger{ height:28px; border-radius:8px; padding:0 10px; border:1px solid #fecaca; background:#fef2f2; color:#dc2626; cursor:pointer; }
.btn.danger:hover{ filter: brightness(0.98); }
.btn.danger:disabled{ opacity:.6; cursor:not-allowed; }
</style>
