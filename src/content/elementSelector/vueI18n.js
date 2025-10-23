import { createI18n } from 'vue-i18n/dist/vue-i18n.esm-bundler';
import enCommon from '@/locales/en/common.json';
import enBlocks from '@/locales/en/blocks.json';
import zhCommon from '@/locales/zh/common.json';
import zhBlocks from '@/locales/zh/blocks.json';

const i18n = createI18n({
  locale: 'zh',
  fallbackLocale: 'en',
  legacy: false,
});

i18n.global.mergeLocaleMessage('en', enCommon);
i18n.global.mergeLocaleMessage('en', enBlocks);
i18n.global.mergeLocaleMessage('zh', zhCommon);
i18n.global.mergeLocaleMessage('zh', zhBlocks);

export default i18n;
