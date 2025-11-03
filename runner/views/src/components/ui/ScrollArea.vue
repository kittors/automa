<template>
  <div class="sa" @mouseenter="hover = true" @mouseleave="hover = false">
    <div ref="viewport" class="sa__viewport" @scroll="onScroll">
      <slot />
    </div>
    <div
      v-show="vNeeded"
      class="sa__v"
      :class="{ 'is-visible': hoverV || draggingV, 'is-hover': hoverV }"
      @mouseenter="hoverV = true"
      @mouseleave="hoverV = false"
      @mousedown.stop="onVTrackDown"
    >
      <div class="sa__thumb" :style="vStyle" @mousedown.stop="onVThumbDown" />
    </div>
    <div
      v-show="hNeeded"
      class="sa__h"
      :class="{ 'is-visible': hoverH || draggingH, 'is-hover': hoverH }"
      @mouseenter="hoverH = true"
      @mouseleave="hoverH = false"
      @mousedown.stop="onHTrackDown"
    >
      <div class="sa__thumb" :style="hStyle" @mousedown.stop="onHThumbDown" />
    </div>
  </div>
  </template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, defineExpose } from 'vue';

const viewport = ref(null);
const hover = ref(false);
const hoverV = ref(false);
const hoverH = ref(false);
const draggingV = ref(false);
const draggingH = ref(false);
const dims = reactive({ cw: 0, ch: 0, sw: 0, sh: 0, st: 0, sl: 0 });
const lock = reactive({ axis: null, left: 0, top: 0 });

// 与样式保持一致：垂直轨道上下各 4px、水平轨道左右各 4px
const TRACK_MARGIN_V = 8; // top + bottom
const TRACK_MARGIN_H = 8; // left + right
const trackVLen = computed(() => Math.max(0, dims.ch - TRACK_MARGIN_V));
const trackHLen = computed(() => Math.max(0, dims.cw - TRACK_MARGIN_H));

const vNeeded = computed(() => dims.sh > dims.ch + 1);
const hNeeded = computed(() => dims.sw > dims.cw + 1);

const vThumb = computed(() => {
  const track = trackVLen.value; // 可用轨道长度（已扣除上下间距）
  const ratio = dims.ch / Math.max(dims.sh, 1);
  const size = Math.max(30, track * ratio);
  const maxPos = Math.max(0, track - size);
  const scrollRange = Math.max(1, dims.sh - dims.ch);
  const pos = maxPos <= 0 ? 0 : (dims.st / scrollRange) * maxPos;
  return { size, pos };
});
const hThumb = computed(() => {
  const track = trackHLen.value;
  const ratio = dims.cw / Math.max(dims.sw, 1);
  const size = Math.max(30, track * ratio);
  const maxPos = Math.max(0, track - size);
  const scrollRange = Math.max(1, dims.sw - dims.cw);
  const pos = maxPos <= 0 ? 0 : (dims.sl / scrollRange) * maxPos;
  return { size, pos };
});

const vStyle = computed(() => ({ height: vThumb.value.size + 'px', transform: `translateY(${vThumb.value.pos}px)` }));
const hStyle = computed(() => ({ width: hThumb.value.size + 'px', transform: `translateX(${hThumb.value.pos}px)` }));

function readDims() {
  const el = viewport.value;
  if (!el) return;
  dims.cw = el.clientWidth; dims.ch = el.clientHeight;
  dims.sw = el.scrollWidth; dims.sh = el.scrollHeight;
  dims.st = el.scrollTop; dims.sl = el.scrollLeft;
}
function onScroll() { readDims(); }

let ro = null;
onMounted(() => {
  readDims();
  ro = new ResizeObserver(() => readDims());
  ro.observe(viewport.value);
});
onBeforeUnmount(() => { if (ro) ro.disconnect(); });

let dragStartY = 0, dragStartTop = 0;
function disableGlobalSelect() {
  try {
    const doc = document.documentElement;
    const body = document.body;
    doc.__prevUserSelect = doc.style.userSelect;
    body.__prevUserSelect = body.style.userSelect;
    doc.style.userSelect = 'none';
    body.style.userSelect = 'none';
    // 兼容前缀
    doc.style.webkitUserSelect = 'none';
    body.style.webkitUserSelect = 'none';
    doc.style.msUserSelect = 'none';
    body.style.msUserSelect = 'none';
  } catch (_) {}
}
function restoreGlobalSelect() {
  try {
    const doc = document.documentElement;
    const body = document.body;
    doc.style.userSelect = doc.__prevUserSelect || '';
    body.style.userSelect = body.__prevUserSelect || '';
    doc.style.webkitUserSelect = '';
    body.style.webkitUserSelect = '';
    doc.style.msUserSelect = '';
    body.style.msUserSelect = '';
  } catch (_) {}
}
function onVThumbDown(e) {
  e.preventDefault();
  draggingV.value = true; dragStartY = e.pageY; dragStartTop = dims.st;
  // 轴锁：拖拽纵向时锁定横向位置
  lock.axis = 'v';
  lock.left = viewport.value?.scrollLeft || 0;
  disableGlobalSelect();
  window.addEventListener('mousemove', onVDrag);
  window.addEventListener('mouseup', onVUp);
}
function onVTrackDown(e) {
  // 点击轨道：跳转到对应位置，并进入拖拽
  const el = viewport.value; if (!el) return;
  const trackEl = e.currentTarget;
  const rect = trackEl.getBoundingClientRect();
  const clickY = e.clientY - rect.top;
  const size = vThumb.value.size;
  const maxPos = Math.max(0, rect.height - size);
  const pos = Math.min(maxPos, Math.max(0, clickY - size / 2));
  const ratio = (dims.sh - dims.ch) / (maxPos || 1);
  el.scrollTop = Math.min(dims.sh - dims.ch, Math.max(0, pos * ratio));
  // 进入拖拽模式
  e.preventDefault();
  draggingV.value = true; dragStartY = e.pageY; dragStartTop = el.scrollTop;
  window.addEventListener('mousemove', onVDrag);
  window.addEventListener('mouseup', onVUp);
}
function onVDrag(e) {
  const el = viewport.value; if (!el) return;
  const travel = trackVLen.value - vThumb.value.size;
  if (travel <= 0) return;
  const delta = e.pageY - dragStartY;
  const scrollRange = Math.max(0, dims.sh - dims.ch);
  const next = dragStartTop + delta * (scrollRange / Math.max(1, travel));
  el.scrollTop = Math.min(scrollRange, Math.max(0, next));
  if (lock.axis === 'v' && el.scrollLeft !== lock.left) el.scrollLeft = lock.left;
}
function onVUp() {
  draggingV.value = false;
  restoreGlobalSelect();
  lock.axis = null;
  window.removeEventListener('mousemove', onVDrag);
  window.removeEventListener('mouseup', onVUp);
}

let dragStartX = 0, dragStartLeft = 0;
function onHThumbDown(e) {
  e.preventDefault();
  draggingH.value = true; dragStartX = e.pageX; dragStartLeft = dims.sl;
  lock.axis = 'h';
  lock.top = viewport.value?.scrollTop || 0;
  disableGlobalSelect();
  window.addEventListener('mousemove', onHDrag);
  window.addEventListener('mouseup', onHUp);
}
function onHTrackDown(e) {
  const el = viewport.value; if (!el) return;
  const trackEl = e.currentTarget;
  const rect = trackEl.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const size = hThumb.value.size;
  const maxPos = Math.max(0, rect.width - size);
  const pos = Math.min(maxPos, Math.max(0, clickX - size / 2));
  const ratio = (dims.sw - dims.cw) / (maxPos || 1);
  el.scrollLeft = Math.min(dims.sw - dims.cw, Math.max(0, pos * ratio));
  e.preventDefault();
  draggingH.value = true; dragStartX = e.pageX; dragStartLeft = el.scrollLeft;
  window.addEventListener('mousemove', onHDrag);
  window.addEventListener('mouseup', onHUp);
}
function onHDrag(e) {
  const el = viewport.value; if (!el) return;
  const travel = trackHLen.value - hThumb.value.size;
  if (travel <= 0) return;
  const delta = e.pageX - dragStartX;
  const scrollRange = Math.max(0, dims.sw - dims.cw);
  const next = dragStartLeft + delta * (scrollRange / Math.max(1, travel));
  el.scrollLeft = Math.min(scrollRange, Math.max(0, next));
  if (lock.axis === 'h' && el.scrollTop !== lock.top) el.scrollTop = lock.top;
}
function onHUp() {
  draggingH.value = false;
  restoreGlobalSelect();
  lock.axis = null;
  window.removeEventListener('mousemove', onHDrag);
  window.removeEventListener('mouseup', onHUp);
}

defineExpose({ viewportEl: viewport });
</script>

<style scoped>
.sa{ position: relative; border-radius: 12px; overflow: hidden; }
.sa__viewport{ width: 100%; height: 100%; overflow: auto; scrollbar-width: none; }
.sa__viewport::-webkit-scrollbar{ width: 0; height: 0; }

.sa__v, .sa__h{ position: absolute; pointer-events: auto; opacity: .6; transition: opacity .15s ease, background-color .12s ease; background: transparent; }
.sa__v.is-visible, .sa__h.is-visible{ opacity: 1; }

.sa__v{ top: 4px; bottom: 4px; right: 2px; width: 10px; border-radius: 9999px; }
.sa__h{ left: 4px; right: 4px; bottom: 2px; height: 10px; border-radius: 9999px; }
.sa__v.is-hover{ background: #eef2f7; }
.sa__h.is-hover{ background: #eef2f7; }

.sa__thumb{ position: absolute; background: #cbd5e1; border-radius: 9999px; box-shadow: 0 1px 2px rgba(0,0,0,.08); pointer-events: auto; transition: transform .12s ease, background-color .12s ease; cursor: pointer; }
.sa__v .sa__thumb{ width: 100%; }
.sa__h .sa__thumb{ height: 100%; }

.sa:hover .sa__thumb{ background: #9ca3af; }
.sa__thumb:active{ background: #6b7280; }
</style>
