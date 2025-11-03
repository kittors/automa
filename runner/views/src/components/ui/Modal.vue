<template>
  <teleport to="body">
    <transition :name="maskTransition">
      <div v-if="show" class="modal-mask" @click.self="onClose">
        <transition :name="transition">
          <div class="modal" role="dialog" aria-modal="true" :style="style">
            <div class="modal__head">
              <div class="modal__title">{{ title }}</div>
              <button v-if="closable" class="modal__close" @click="onClose" aria-label="关闭">×</button>
            </div>
            <div class="modal__body">
              <slot />
            </div>
            <div v-if="hasFooter" class="modal__foot">
              <slot name="footer" />
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
  </template>

<script setup>
import { onMounted, onBeforeUnmount, computed, useSlots } from 'vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: [Number, String], default: 640 },
  closable: { type: Boolean, default: true },
  transition: { type: String, default: 'fade-scale' },
  maskTransition: { type: String, default: 'fade' },
});
const emit = defineEmits(['close']);

function onClose(){ emit('close'); }
function onKey(e){ if (e.key === 'Escape') onClose(); }
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));

const style = computed(() => {
  const w = typeof props.width === 'number' ? props.width + 'px' : props.width;
  return { width: w };
});

const slots = useSlots();
const hasFooter = computed(() => !!slots.footer);
</script>

<style scoped>
.modal-mask{ position: fixed; inset: 0; background: rgba(15, 23, 42, .45); display:flex; align-items:center; justify-content:center; z-index: 2000; }
.modal{ background:#fff; border:1px solid var(--c-border); border-radius:12px; box-shadow: 0 16px 40px rgba(15, 23, 42, .2); max-width: 90vw; max-height: 85vh; display:flex; flex-direction:column; }
.modal__head{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--c-border); }
.modal__title{ font-weight:700; color:#0f172a; }
.modal__close{ width:28px; height:28px; border-radius:8px; border:1px solid var(--c-border); background:#fff; cursor:pointer; }
.modal__body{ padding: 12px 14px; overflow:auto; }
.modal__foot{ padding: 10px 14px; border-top:1px solid var(--c-border); display:flex; align-items:center; justify-content:flex-end; gap:8px; }
.btn.light{ background: #fff; border: 1px solid var(--c-border); border-radius: 8px; height: 32px; padding: 0 12px; cursor: pointer; }

/* 默认动画：fade（遮罩） */
.fade-enter-active, .fade-leave-active { transition: opacity .16s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 默认动画：fade-scale（对话框） */
.fade-scale-enter-active, .fade-scale-leave-active { transition: opacity .18s ease, transform .18s ease; transform-origin: 50% 46%; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; transform: translateY(-6px) scale(.96); }

/* 可选动画：slide-up */
.slide-up-enter-active, .slide-up-leave-active { transition: opacity .18s ease, transform .18s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(12px); }

/* 可选动画：zoom-in */
.zoom-in-enter-active, .zoom-in-leave-active { transition: opacity .18s ease, transform .18s ease; }
.zoom-in-enter-from, .zoom-in-leave-to { opacity: 0; transform: scale(.92); }
</style>
