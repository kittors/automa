import { createApp } from 'vue';
import App from './App.vue';
import './styles/theme.css';
import router from './router/index.js';
import { APP_NAME } from './config/app.js';

const app = createApp(App);
app.use(router);

router.afterEach((to) => {
  const t = to?.meta?.title ? `${to.meta.title} - ${APP_NAME}` : APP_NAME;
  document.title = t;
});

app.mount('#app');
