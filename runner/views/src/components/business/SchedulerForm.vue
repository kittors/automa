<template>
  <form class="sf" @submit.prevent="onSubmit">
    <div class="field">
      <label class="lbl">任务名称 <span class="req">*</span></label>
      <div class="ctl">
        <input v-model.trim="model.name" class="ipt" placeholder="例如：每日 9:00 执行百度搜索" />
        <p v-if="errors.name" class="err">{{ errors.name }}</p>
      </div>
    </div>

    <div class="field">
      <label class="lbl">选择工作流 <span class="req">*</span></label>
      <div class="ctl">
        <UiSelect
          :model-value="model.workflow"
          :options="workflowOptions"
          placeholder="选择工作流"
          @update:modelValue="(v)=> model.workflow = v"
        />
        <p v-if="errors.workflow" class="err">{{ errors.workflow }}</p>
      </div>
    </div>

    <div class="field">
      <label class="lbl">触发类型 <span class="req">*</span></label>
      <div class="ctl">
        <UiSelect
          :model-value="model.type"
          :options="typeOptions"
          placeholder="选择触发类型"
          @update:modelValue="(v)=> model.type = v"
        />
        <p v-if="errors.type" class="err">{{ errors.type }}</p>
      </div>
    </div>

    <div class="field" v-if="model.type==='cron'">
      <label class="lbl">Cron 表达式 <span class="req">*</span></label>
      <div class="ctl">
        <input v-model.trim="model.cron" class="ipt" placeholder="0 9 * * *（每日 9:00）" />
        <p v-if="errors.cron" class="err">{{ errors.cron }}</p>
      </div>
    </div>

    <div class="field" v-if="model.type==='interval'">
      <label class="lbl">间隔（分钟） <span class="req">*</span></label>
      <div class="ctl">
        <input v-model.number="model.interval" type="number" min="1" class="ipt" placeholder="60" />
        <p v-if="errors.interval" class="err">{{ errors.interval }}</p>
      </div>
    </div>

    <div class="field" v-if="model.type==='once'">
      <label class="lbl">执行时间 <span class="req">*</span></label>
      <div class="ctl">
        <UiDateTime v-model="model.onceAt" placeholder="选择日期时间" />
        <p v-if="errors.onceAt" class="err">{{ errors.onceAt }}</p>
      </div>
    </div>

  </form>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import UiSelect from '../ui/UiSelect.vue';
import UiDateTime from '../ui/UiDateTime.vue';

const props = defineProps({
  workflows: { type: Array, default: () => [] },
  value: { type: Object, default: () => ({ name:'', workflow:'', type:'cron', cron:'', interval:60, onceAt:'' }) },
});
const emit = defineEmits(['submit','cancel']);

const model = reactive({ name:'', workflow:'', type:'cron', cron:'', interval:60, onceAt:'' });
watch(() => props.value, (v) => Object.assign(model, v || {}), { immediate: true });

const errors = reactive({});

const workflowOptions = computed(() => (props.workflows || []).map(w => ({ label: w.name || w.file, value: w.file })));
const typeOptions = [
  { label: 'Cron 表达式', value: 'cron' },
  { label: '固定间隔（分钟）', value: 'interval' },
  { label: '一次性（日期时间）', value: 'once' },
];

function isValidCron(s){
  if (!s) return false;
  const parts = s.trim().split(/\s+/);
  return parts.length === 5; // 简化校验：5 段
}

function validate(){
  Object.keys(errors).forEach(k => delete errors[k]);
  if (!model.name) errors.name = '请输入任务名称';
  if (!model.workflow) errors.workflow = '请选择工作流';
  if (!model.type) errors.type = '请选择触发类型';
  if (model.type === 'cron') {
    if (!model.cron) errors.cron = '请输入 Cron 表达式';
    else if (!isValidCron(model.cron)) errors.cron = 'Cron 格式应为 5 段（分 时 日 月 周）';
  }
  if (model.type === 'interval') {
    if (!model.interval || model.interval < 1) errors.interval = '间隔需为 >= 1 的整数';
  }
  if (model.type === 'once') {
    if (!model.onceAt) errors.onceAt = '请选择执行时间';
  }
  return Object.keys(errors).length === 0;
}

function onSubmit(){
  if (!validate()) return;
  emit('submit', { ...model });
}

defineExpose({
  submit: onSubmit,
  cancel: () => emit('cancel'),
});
</script>

<style scoped>
.sf{ display:flex; flex-direction:column; gap:10px; }
.field{ display:flex; flex-direction:column; gap:6px; }
.ctl{ position: relative; padding-bottom: 18px; }
.lbl{ color: var(--c-dim); font-size: 12px; display:inline-flex; align-items:center; gap:4px; }
.req{ color:#dc2626; font-weight:700; }
.ipt{ height: 36px; border:1px solid var(--c-border); border-radius:8px; padding: 0 10px; }
.err{ color: #dc2626; font-size: 12px; position: absolute; left: 0; bottom: -15px; line-height: 16px; }
</style>
