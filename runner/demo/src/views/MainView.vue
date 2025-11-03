<template>
  <div class="layout">
    <div class="main">
      <Toolbar
        :workflows="workflows"
        v-model="selectedWf"
        :run-id="runId"
        :disabled="busy"
        :disabled-start="busy"
        :disabled-clear="busy && !!es"
        @start="start"
        @clear="clearLogs"
      />
      <LogsPanel :logs="logs" />
    </div>
    <aside class="aside">
      <RunningList />
    </aside>
  </div>
</template>

<script setup>
import Toolbar from '../components/Toolbar.vue';
import LogsPanel from '../components/LogsPanel.vue';
import RunningList from '../components/RunningList.vue';
import { useRunner } from '../composables/useRunner.js';
import { onMounted } from 'vue';

const { logs, runId, busy, es, workflows, selectedWf, loadWorkflows, start, clearLogs } = useRunner();

onMounted(() => { loadWorkflows(); });
</script>

<style scoped>
.layout{ display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 1024px){
  .layout{ grid-template-columns: 640px 320px; }
  .main{ width: 640px; }
  .aside{ width: 320px; }
}
.aside{ align-self: start; }
</style>
