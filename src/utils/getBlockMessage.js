import enLocale from '../locales/en/newtab.json';
import zhLocale from '../locales/zh/newtab.json';

export default function ({ message, ...data }) {
  const normalize = (value) => value.join('');
  const interpolate = (key) => data[key];
  const named = (key) => key;

  let currentLang = 'zh';
  try {
    const docLang =
      (typeof document !== 'undefined' && document.documentElement.lang) || '';
    const navLang =
      (typeof navigator !== 'undefined' && navigator.language) || '';
    const lang = (docLang || navLang || '').toLowerCase();
    if (lang.startsWith('en')) currentLang = 'en';
    else if (lang.startsWith('zh')) currentLang = 'zh';
    else currentLang = 'zh';
  } catch (_) {
    currentLang = 'zh';
  }

  const locale = currentLang === 'en' ? enLocale : zhLocale;
  const localeMessage = locale.log?.messages?.[message];
  if (localeMessage) return localeMessage({ normalize, interpolate, named });

  return message;
}
