import { createRouter, createWebHistory } from 'vue-router';
import MainView from '../views/MainView.vue';
import SchedulerView from '../views/SchedulerView.vue';

const routes = [
  { path: '/', name: 'home', component: MainView, meta: { title: '工作流执行' } },
  { path: '/app', name: 'workflows', component: MainView, meta: { title: '工作流执行' } },
  { path: '/scheduler', name: 'scheduler', component: SchedulerView, meta: { title: '定时任务编排' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
