import { createApp } from 'vue';
import vRemixicon from 'v-remixicon';
import Browser from 'webextension-polyfill';
import App from './App.vue';
import compsUi from './compsUi';
import icons from './icons';
import vueI18n from './vueI18n';
import '@/assets/css/tailwind.css';

export default function (rootElement) {
  const appRoot = document.createElement('div');
  appRoot.setAttribute('id', 'app');

  rootElement.shadowRoot.appendChild(appRoot);

  const app = createApp(App)
    .provide('rootElement', rootElement)
    .use(vueI18n)
    .use(vRemixicon, icons)
    .use(compsUi);

  // Mount first to render quickly, then adopt stored locale
  app.mount(appRoot);

  // Apply user-configured locale if available
  Browser.storage.local.get('settings').then(({ settings }) => {
    if (settings?.locale) {
      vueI18n.global.locale.value = settings.locale;
    }
  });
}
