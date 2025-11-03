<template>
  <section class="card toolbar">
    <div class="row gap12">
      <label for="wf">工作流</label>
      <UiSelect
        :model-value="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
        :options="options"
        :disabled="disabled"
        placeholder="选择工作流"
        filterable
      />
      <button class="btn primary" @click="$emit('start')" :disabled="disabledStart">{{ disabled ? '运行中…' : '开始执行' }}</button>
      <button class="btn light" @click="$emit('clear')" :disabled="disabledClear">清空日志</button>
      <div class="runid" v-if="runId">Run ID <span class="badge">{{ runId }}</span></div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import UiSelect from '../ui/UiSelect.vue';

const props = defineProps({
  workflows: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  runId: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  disabledStart: { type: Boolean, default: false },
  disabledClear: { type: Boolean, default: false },
});
defineEmits(['update:modelValue','start','clear']);

const options = computed(() => (props.workflows || []).map(w => ({ label: w.name || w.file, value: w.file })));
</script>

<style scoped>
.card{ background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px; padding: 14px; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.06); }
.toolbar{ margin-bottom: 14px; }
.row{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gap12{ gap: 12px; }
label{ color: var(--c-dim); font-weight: 600; }

.btn{ height: 36px; border-radius: 10px; padding: 0 16px; border: 1px solid var(--c-border); cursor: pointer; font-weight: 600; }
.btn.primary{ background: var(--c-primary); color: #fff; border-color: transparent; box-shadow: 0 6px 16px rgba(37,99,235,.3); }
.btn.primary:hover{ filter: brightness(1.05); }
.btn.light{ background: #fff; color: var(--c-fg); }
.btn[disabled]{ opacity: .6; cursor: not-allowed; box-shadow: none; }

.runid{ margin-left:auto; color: var(--c-dim); display: flex; align-items: center; gap: 8px; }
.badge{ background: var(--c-primary-50); color: var(--c-blue); border: 1px solid var(--c-primary-100); padding: 2px 8px; border-radius: 9999px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
</style>
