<template>
  <section class="card wf-progress" v-if="nodes && nodes.length">
    <div class="head">
      <div class="name" :title="name">{{ name || '工作流' }}</div>
      <div class="status" :class="status">{{ statusLabel }}</div>
    </div>
    <div class="track">
      <div v-for="(n, i) in nodes" :key="n.id" class="node" :class="stateClass(i)" :title="nodeTitle(n)" @click="onClick(i)">
        <span class="badge">{{ i + 1 }}</span>
        <span class="label">{{ n.label }}</span>
        <span v-if="stateClass(i) === 'active'" class="spinner" aria-hidden="true"></span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  meta: { type: Object, default: () => ({ name: '', nodes: [] }) },
  progress: { type: Object, default: () => ({ index: 0, states: [] , status: 'idle'}) },
});
const emit = defineEmits(['select']);

const name = computed(() => props.meta?.name || '');
const nodes = computed(() => Array.isArray(props.meta?.nodes) ? props.meta.nodes : []);
const status = computed(() => props.progress?.status || 'idle');
const statusLabel = computed(() => ({ idle: '待开始', running: '执行中', stopped: '已停止', succeeded: '已完成', failed: '已失败' })[status.value] || '');

function stateClass(i){
  const st = (props.progress && Array.isArray(props.progress.states)) ? props.progress.states[i] : undefined;
  return st || 'pending';
}
function nodeTitle(n){
  return (n.desc ? (n.label + ' · ' + n.desc) : n.label);
}
function onClick(i){ emit('select', i); }
</script>

<style scoped>
.wf-progress{ margin-bottom: 14px; }
.head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.name{ font-weight:700; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.status{ font-size:12px; padding:2px 8px; border-radius:9999px; border:1px solid #e5e7eb; }
.status.running{ background:#eff6ff; color:#2563eb; border-color:#bfdbfe; }
.status.succeeded{ background:#ecfdf5; color:#16a34a; border-color:#bbf7d0; }
.status.failed{ background:#fef2f2; color:#dc2626; border-color:#fecaca; }
.status.stopped{ background:#f1f5f9; color:#64748b; border-color:#cbd5e1; }

.track{ display:flex; gap:8px; overflow:auto; }
.node{ display:flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid #e5e7eb; border-radius:10px; background:#fff; white-space:nowrap; cursor: pointer; user-select: none; }
.badge{ width:18px; height:18px; border-radius:9999px; background:#eef2f7; color:#475569; display:inline-flex; align-items:center; justify-content:center; font-size:12px; }
.label{ color:#0f172a; font-weight:600; }
.node.pending{ opacity:.7; }
.node.active{ border-color:#bfdbfe; background:#eff6ff; }
.node.done{ border-color:#bbf7d0; background:#ecfdf5; }
.node.error{ border-color:#fecaca; background:#fef2f2; }

.spinner{ width:12px; height:12px; border-radius:50%; border:2px solid #93c5fd; border-top-color:#2563eb; animation: spin 0.9s linear infinite; }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
</style>

