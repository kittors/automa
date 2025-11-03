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
      <WorkflowProgress :meta="wfMeta" :progress="wfProgress" @select="onSelectNode" />
      <LogsPanel :logs="logs" />
    </div>
    <aside class="aside">
      <RunningList />
    </aside>
    <NodeDetailsModal :show="showDetails" :node="selNode" :details="selDetails" @close="showDetails=false" />
  </div>
</template>

<script setup>
import Toolbar from '../components/business/Toolbar.vue';
import LogsPanel from '../components/business/LogsPanel.vue';
import RunningList from '../components/business/RunningList.vue';
import WorkflowProgress from '../components/business/WorkflowProgress.vue';
import { useRunner } from '../composables/useRunner.js';
import { onMounted, ref, computed } from 'vue';
import NodeDetailsModal from '../components/business/NodeDetailsModal.vue';

const { logs, runId, busy, es, workflows, selectedWf, loadWorkflows, start, clearLogs, wfMeta, wfProgress, nodeDetails } = useRunner();
const showDetails = ref(false);
const selIndex = ref(-1);
const selNode = computed(() => {
  const nodes = (wfMeta?.value && Array.isArray(wfMeta.value.nodes)) ? wfMeta.value.nodes : [];
  return selIndex.value >= 0 && nodes[selIndex.value] ? nodes[selIndex.value] : null;
});
const selDetails = computed(() => {
  if (!selNode.value) return null;
  const map = (nodeDetails && nodeDetails.value) ? nodeDetails.value : {};
  return map[selNode.value.id] || { status: 'pending', logs: [] };
});
function onSelectNode(i){ selIndex.value = i; showDetails.value = true; }

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
