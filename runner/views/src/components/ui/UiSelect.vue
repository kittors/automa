<template>
  <div
    class="ui-select"
    :class="{ 'is-open': open, 'is-disabled': disabled }"
    ref="root"
    @keydown.stop="onKeydown"
  >
    <div class="ui-select__trigger" @mousedown.prevent="toggle" role="combobox" :aria-expanded="open" :aria-disabled="disabled" tabindex="0">
      <span v-if="!open || !filterable" class="ui-select__label" :class="{ 'is-placeholder': !selectedLabel }">
        {{ selectedLabel || placeholder }}
      </span>
      <input
        v-if="open && filterable"
        ref="input"
        class="ui-select__input"
        type="text"
        :placeholder="placeholder"
        v-model="query"
        @click.stop
      />
      <component :is="open ? ChevronUp : ChevronDown" class="ui-select__icon" aria-hidden="true" />
    </div>

    <teleport to="#app">
      <transition name="fade-slide">
        <div
          v-if="open"
          ref="dropdown"
          class="ui-select__dropdown portal"
          :style="dropdownStyle"
          @mousedown.prevent
        >
          <ul class="ui-select__list" role="listbox">
            <li
              v-for="(opt, i) in filtered"
              :key="opt.value"
              class="ui-select__option"
              :class="{ 'is-active': i === hoverIndex, 'is-selected': opt.value === modelValue }"
              @mouseenter="hoverIndex = i"
              @click="select(opt)"
              role="option"
              :aria-selected="opt.value === modelValue"
            >
              {{ opt.label }}
            </li>
            <li v-if="filtered.length === 0" class="ui-select__empty">无匹配项</li>
          </ul>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick, reactive } from 'vue';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';

const props = defineProps({
  modelValue: { type: [String, Number, null], default: '' },
  options: { type: Array, default: () => [] }, // [{ label, value }]
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  filterable: { type: Boolean, default: true },
});
const emit = defineEmits(['update:modelValue', 'change']);

const open = ref(false);
const query = ref('');
const hoverIndex = ref(-1);
const root = ref(null);
const input = ref(null);
const dropdown = ref(null);

const selected = computed(() => props.options.find((o) => o.value === props.modelValue));
const selectedLabel = computed(() => selected.value ? selected.value.label : '');
const hasValue = computed(() => selected.value != null);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!props.filterable || !q) return props.options;
  return props.options.filter((o) => String(o.label || '').toLowerCase().includes(q));
});

function openDropdown() {
  if (props.disabled) return;
  open.value = true;
  hoverIndex.value = Math.max(0, filtered.value.findIndex((o) => o.value === props.modelValue));
  nextTick(() => input.value && input.value.focus());
  nextTick(() => { positionDropdown(); bindScrollParents(); });
}
function closeDropdown() {
  open.value = false;
  query.value = '';
  hoverIndex.value = -1;
  cleanupScrollParents();
}
function toggle() {
  open.value ? closeDropdown() : openDropdown();
}
function select(opt) {
  emit('update:modelValue', opt.value);
  emit('change', opt.value);
  closeDropdown();
}
function onKeydown(e) {
  const handledKeys = ['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Escape'];
  if (!open.value && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
    e.preventDefault();
    return openDropdown();
  }
  if (!open.value) return; // 其余按键不拦截
  if (e.key === 'Escape') { e.preventDefault(); return closeDropdown(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); hoverIndex.value = Math.min(filtered.value.length - 1, hoverIndex.value + 1); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); hoverIndex.value = Math.max(0, hoverIndex.value - 1); return; }
  if (e.key === 'Enter') { e.preventDefault(); const opt = filtered.value[hoverIndex.value]; if (opt) select(opt); return; }
}

function onDocClick(e) {
  const r = root.value;
  const d = dropdown.value;
  if (!r) return;
  if (r.contains(e.target)) return;
  if (d && d.contains(e.target)) return;
  closeDropdown();
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  window.addEventListener('scroll', onViewport, { passive: true });
  window.addEventListener('resize', onViewport, { passive: true });
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  window.removeEventListener('scroll', onViewport);
  window.removeEventListener('resize', onViewport);
  cleanupScrollParents();
});

watch(() => props.disabled, (d) => d && closeDropdown());

// Teleport 下拉定位 + 容器滚动同步
const dropdownStyle = reactive({ left: '0px', top: '0px', width: '0px' });
let scrollParents = [];

function getScrollParents(node) {
  const parents = [];
  if (!node) return parents;
  let p = node.parentElement;
  const scrollRegex = /(auto|scroll|overlay)/;
  while (p && p !== document.body) {
    const style = window.getComputedStyle(p);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    if (scrollRegex.test(overflowY) || scrollRegex.test(overflowX)) parents.push(p);
    p = p.parentElement;
  }
  parents.push(document.body);
  return parents;
}

function bindScrollParents() {
  cleanupScrollParents();
  scrollParents = getScrollParents(root.value);
  scrollParents.forEach(el => el.addEventListener('scroll', onViewport, { passive: true }));
}
function cleanupScrollParents() {
  if (scrollParents && scrollParents.length) {
    scrollParents.forEach(el => el.removeEventListener('scroll', onViewport));
  }
  scrollParents = [];
}

function positionDropdown() {
  const el = root.value;
  const d = dropdown.value;
  if (!el || !d) return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const margin = 6;
  const width = rect.width;
  let left = rect.left;
  if (left + width > vw - 4) left = Math.max(4, vw - width - 4);

  // 默认向下展开，不够空间则向上
  const dHeight = d.offsetHeight || 260; // 预估高度
  let top = rect.bottom + margin;
  if (top + dHeight > vh && rect.top - margin - dHeight > 0) {
    top = rect.top - margin - dHeight;
    d.classList.add('drop-up');
  } else {
    d.classList.remove('drop-up');
  }
  dropdownStyle.left = left + 'px';
  dropdownStyle.top = Math.max(4, top) + 'px';
  dropdownStyle.width = width + 'px';
}
function onViewport(){ if (open.value) positionDropdown(); }
</script>

<style scoped>
.ui-select{ position: relative; width: 300px; font-size: 14px; }
.ui-select.is-disabled{ opacity: .6; pointer-events: none; }
.ui-select__trigger{
  display: flex; align-items: center; gap: 8px;
  height: 36px; padding: 0 36px 0 12px;
  background: #fff; border: 1px solid var(--c-border); border-radius: 10px;
  box-shadow: 0 1px 0 rgba(0,0,0,.02) inset; cursor: pointer;
}
.ui-select__trigger:focus-within{ border-color: var(--c-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
.ui-select__label{ flex: 1 1 auto; color: var(--c-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ui-select__label.is-placeholder{ color: var(--c-dim); }
.ui-select__input{ flex: 1 1 auto; height: 100%; border: none; outline: none; font: inherit; color: var(--c-fg); }
.ui-select__icon{ position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--c-dim); display: inline-flex; align-items: center; justify-content: center; pointer-events: none; }

.ui-select__dropdown{ position: absolute; left: 0; right: 0; margin-top: 6px; background: #fff; border: 1px solid var(--c-border); border-radius: 10px; box-shadow: 0 12px 28px rgba(37,99,235,.12); }
.ui-select__dropdown.portal{ position: fixed; margin-top: 0; z-index: 5000; }
.ui-select__dropdown.portal.drop-up{ transform-origin: bottom; }
.ui-select__list{ list-style: none; margin: 6px 0; padding: 4px 6px; max-height: 260px; overflow: auto; }
.ui-select__option{ padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.ui-select__option.is-active{ background: var(--c-primary-50); }
.ui-select__option.is-selected{ background: #eef2ff; color: var(--c-blue); font-weight: 700; }
.ui-select__empty{ padding: 12px; color: var(--c-dim); text-align: center; }

.fade-slide-enter-active, .fade-slide-leave-active { transition: opacity .14s ease, transform .14s ease; transform-origin: top; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: translateY(-4px) scaleY(.98); }
</style>

