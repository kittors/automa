import axios from 'axios';

const instance = axios.create({ baseURL: '' });

instance.interceptors.response.use(
  (resp) => resp.data,
  (error) => {
    const resp = error && error.response && error.response.data;
    if (resp && typeof resp === 'object' && 'code' in resp) return Promise.reject(resp);
    return Promise.reject({ code: error?.response?.status || 500, msg: error?.message || 'Network Error', data: null });
  }
);

export const http = {
  get: (url, params) => instance.get(url, { params }),
  post: (url, data) => instance.post(url, data),
  put: (url, data) => instance.put(url, data),
};

// 简单 SSE 封装：默认将 payload.data 传给回调
export function openSse(url, { onData, onError, mapData = true } = {}) {
  let es;
  try {
    es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (mapData && payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
          onData && onData(payload.data, payload);
        } else {
          onData && onData(payload, payload);
        }
      } catch (e) {
        // 忽略解析错误
      }
    };
    es.onerror = (e) => { onError && onError(e); };
  } catch (e) {
    onError && onError(e);
  }
  return {
    close() { try { es && es.close(); } catch (_) {} },
    _es: es,
  };
}

