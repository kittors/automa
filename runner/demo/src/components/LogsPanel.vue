<template>
  <section class="card">
    <h3 class="title">Logs</h3>
    <div v-if="!logs || logs.length === 0" class="empty">
      <Info class="empty__icon" />
      <div>
        <div class="empty__title">暂无日志</div>
        <div class="empty__desc">请选择工作流并点击“开始执行”以查看实时日志</div>
      </div>
    </div>
    <ScrollArea v-else class="logs-area" ref="sa">
      <div class="scroll-content">
        <div v-for="(l, idx) in logs" :key="idx" class="line" :data-level="l.type">
          <span class="ts">[{{ l.ts }}]</span>
          <span class="type">{{ l.type }}</span>
          <span class="txt">— {{ l.text }}</span>
        </div>
      </div>
    </ScrollArea>
  </section>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import ScrollArea from './ui/ScrollArea.vue';
import { Info } from 'lucide-vue-next';

const props = defineProps({ logs: { type: Array, default: () => [] } });
const sa = ref(null);

watch(() => props.logs.length, async () => {
  const box = sa.value?.viewportEl;
  if (!box) return;
  const nearBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 10;
  await nextTick();
  if (nearBottom) box.scrollTop = box.scrollHeight;
});
</script>

<style scoped>
.card{ background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px; padding: 14px; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.06); }
.title{ margin: 0 0 8px; font-weight: 700; font-size: 14px; color: var(--c-fg); }
.logs-area{ margin-top: 8px; background: #fff; border: 1px solid var(--c-border); border-radius: 12px; height: 420px; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.scroll-content{ display: inline-block; min-width: 100%; width: max-content; padding: 12px; }
.line{ white-space: pre; padding: 6px 8px; border-bottom: 1px dashed #e5e7eb; }
.line:last-child{ border-bottom: none; }
.ts{ color: var(--c-dim); margin-right: 10px; }
.type{ display: inline-block; margin-right: 10px; padding: 2px 10px; border-radius: 9999px; font-weight: 700; border: 1px solid #e5e7eb; color: var(--c-blue); background: var(--c-primary-50); }
.txt{ color: #111827; }

/* 彩色映射 */
.line[data-level="info"] .type{ background: #ecfdf5; color: var(--c-green); border-color: #bbf7d0; }
.line[data-level="warn"] .type{ background: #fffbeb; color: var(--c-yellow); border-color: #fde68a; }
.line[data-level="error"] .type,
.line[data-level="pageerror"] .type,
.line[data-level="requestfailed"] .type{ background: #fef2f2; color: var(--c-red); border-color: #fecaca; }
.line[data-level="trace"] .type,
.line[data-level="console"] .type{ background: #f1f5f9; color: #64748b; border-color: #cbd5e1; }
.line[data-level="navigated"] .type{ background: var(--c-primary-50); color: var(--c-blue); border-color: var(--c-primary-100); }

/* 空状态 */
.empty{ display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px dashed #cfe0ff; background: #f7fbff; border-radius: 12px; color: #1e3a8a; }
.empty__icon{ width: 18px; height: 18px; color: #2563eb; }
.empty__title{ font-weight: 700; margin-bottom: 2px; }
.empty__desc{ color: var(--c-dim); font-size: 12px; }
</style>
