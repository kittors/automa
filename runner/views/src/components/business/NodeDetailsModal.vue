<template>
  <Modal :show="show" :title="title" @close="$emit('close')" :width="720">
    <div class="meta">
      <div><b>节点：</b>{{ node?.label }} <span class="muted">(#{{ node?.id }})</span></div>
      <div v-if="node?.desc" class="muted">{{ node.desc }}</div>
      <div class="row">
        <span class="badge" :class="status">{{ statusText }}</span>
        <span v-if="details?.startedAt" class="muted">开始：{{ fmt(details.startedAt) }}</span>
        <span v-if="details?.endedAt" class="muted">结束：{{ fmt(details.endedAt) }}</span>
      </div>
    </div>
    <ScrollArea class="log-area">
      <ul class="logs">
        <li v-for="(l, i) in (details?.logs || [])" :key="i">
          <span class="ts">[{{ l.ts }}]</span>
          <span class="type">{{ l.type }}</span>
          <span class="text">— {{ l.text }}</span>
        </li>
        <li v-if="!details || !(details.logs || []).length" class="muted">暂无详细执行日志</li>
      </ul>
    </ScrollArea>
  </Modal>
 </template>

<script setup>
import Modal from '../ui/Modal.vue';
import ScrollArea from '../ui/ScrollArea.vue';
import { computed } from 'vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  node: { type: Object, default: null },
  details: { type: Object, default: null },
});
defineEmits(['close']);

const title = computed(() => props.node?.label ? `节点详情 · ${props.node.label}` : '节点详情');
const status = computed(() => props.details?.status || 'pending');
const statusText = computed(() => ({ pending:'未开始', active:'执行中', done:'已完成', error:'错误' }[status.value] || ''));
function fmt(s){ try { return new Date(s).toLocaleString(); } catch(_) { return s; } }
</script>

<style scoped>
.meta{ margin-bottom: 8px; display:flex; flex-direction:column; gap:4px; }
.muted{ color: var(--c-dim); }
.row{ display:flex; align-items:center; gap:10px; }
.badge{ padding: 2px 8px; border-radius: 9999px; border: 1px solid #e5e7eb; font-size: 12px; }
.badge.active{ background:#eff6ff; color:#2563eb; border-color:#bfdbfe; }
.badge.done{ background:#ecfdf5; color:#16a34a; border-color:#bbf7d0; }
.badge.error{ background:#fef2f2; color:#dc2626; border-color:#fecaca; }
.log-area{ height: 340px; border: 1px solid var(--c-border); border-radius: 10px; background:#fff; }
.logs{ list-style:none; margin:0; padding:8px 10px; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.ts{ color:#6b7280; margin-right:8px; }
.type{ color:#334155; margin-right:8px; font-weight:700; }
.text{ color:#111827; }
</style>
