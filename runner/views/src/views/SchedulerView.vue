<template>
  <div class="scheduler">
    <section class="card">
      <div class="header">
        <h3 class="title">定时任务编排</h3>
        <button class="btn primary" @click="openModal">新增</button>
      </div>
      <p class="desc">配置基于时间的工作流触发规则（Cron/间隔/一次性）。</p>
    </section>

    <section class="card" style="margin-top:12px;">
      <h3 class="title">任务列表（本地示例）</h3>
      <div v-if="tasks.length===0" class="muted">暂无任务</div>
      <ul v-else class="tasks">
        <li v-for="(t,idx) in tasks" :key="idx" class="task">
          <div class="meta">
            <div class="name">{{ t.name }}</div>
            <div class="sub">{{ t.workflow }} · {{ t.type }} {{ t.type==='cron'?t.cron:(t.type==='interval'? (t.interval+'m'):t.onceAt) }}</div>
          </div>
          <button class="btn light" @click="remove(idx)">删除</button>
        </li>
      </ul>
    </section>

    <Modal :show="show" title="新增定时任务" @close="closeModal">
      <SchedulerForm ref="formRef" :workflows="workflows" @submit="save" @cancel="closeModal" />
      <template #footer>
        <button class="btn light" @click="formRef?.cancel()">取消</button>
        <button class="btn primary" @click="formRef?.submit()">保存</button>
      </template>
    </Modal>
  </div>
  </template>

<script setup>
import { ref, onMounted } from 'vue';
import { http } from '../utils/http.js';
import Modal from '../components/ui/Modal.vue';
import SchedulerForm from '../components/business/SchedulerForm.vue';

const workflows = ref([]);
const tasks = ref([]);
const show = ref(false);
const formRef = ref(null);

onMounted(async () => {
  try{
    const resp = await http.get('/api/workflows');
    const items = (resp && resp.data && resp.data.items) || [];
    workflows.value = items;
    const cache = localStorage.getItem('runner:scheduler:tasks');
    tasks.value = cache ? JSON.parse(cache) : [];
  }catch(_){ tasks.value = []; }
});

function openModal(){ show.value = true; }
function closeModal(){ show.value = false; }
function save(payload){
  tasks.value.push({ ...payload });
  localStorage.setItem('runner:scheduler:tasks', JSON.stringify(tasks.value));
  closeModal();
}
function remove(i){ tasks.value.splice(i,1); localStorage.setItem('runner:scheduler:tasks', JSON.stringify(tasks.value)); }
</script>

<style scoped>
.header{ display:flex; align-items:center; justify-content:space-between; }
.title{ margin:0 0 8px; font-weight:700; }
.desc{ color: var(--c-dim); margin-bottom: 12px; }
.hint{ color: var(--c-green); font-size: 12px; }
.tasks{ list-style:none; margin:0; padding:0; }
.task{ display:flex; align-items:center; justify-content:space-between; padding:10px 6px; border-top:1px solid var(--c-border); }
.task:first-child{ border-top:none; }
.name{ font-weight:600; }
.sub{ color: var(--c-dim); font-size: 12px; }
</style>
