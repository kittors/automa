<template>
  <div class="ui-dt" ref="root">
    <div class="ui-dt__trigger" @mousedown.prevent="toggle" :aria-expanded="open" :aria-disabled="disabled" tabindex="0">
      <span class="ui-dt__label" :class="{ 'is-placeholder': !display }">{{ display || placeholder }}</span>
      <CalendarIcon class="ui-dt__icon" />
    </div>

    <teleport to="#app">
      <transition name="fade-slide">
        <div v-if="open" ref="dropdown" class="ui-dt__dropdown portal" :style="dropdownStyle" @mousedown.stop>
          <div class="ui-dt__head">
            <button class="nav" @click="prevMonth" aria-label="上个月">‹</button>
            <div class="ym">{{ innerYear }} 年 {{ innerMonth + 1 }} 月</div>
            <button class="nav" @click="nextMonth" aria-label="下个月">›</button>
          </div>
          <div class="ui-dt__content">
            <div class="cal" ref="calEl">
              <div class="ui-dt__week">
                <span v-for="w in weekDays" :key="w">{{ w }}</span>
              </div>
              <div class="ui-dt__grid">
                <button
                  v-for="day in days"
                  :key="day.key"
                  class="cell"
                  :class="{ other: day.other, today: day.isToday, sel: isSameDate(day.date, selected) }"
                  @click="selectDate(day.date)"
                >{{ day.date.getDate() }}</button>
              </div>
            </div>
            <div class="side">
              <div class="wheels" ref="wheelsBox" :style="{ height: calHeight + 'px' }">
                <div class="selbar"></div>
                <div class="cols">
                  <div class="col">
                    <div class="tlabel">时</div>
                    <div class="tlist" ref="hList" :style="wheelsListStyle" @scroll="onScroll('h', $event)">
                      <button v-for="h in 24" :key="h-1" class="tbtn" :class="{ on: (h-1)===hours }" @click="scrollToIndex('h', h-1)">{{ pad(h-1) }}</button>
                    </div>
                  </div>
                  <div class="col">
                    <div class="tlabel">分</div>
                    <div class="tlist" ref="mList" :style="wheelsListStyle" @scroll="onScroll('m', $event)">
                      <button v-for="m in 60" :key="m-1" class="tbtn" :class="{ on: (m-1)===minutes }" @click="scrollToIndex('m', m-1)">{{ pad(m-1) }}</button>
                    </div>
                  </div>
                  <div class="col">
                    <div class="tlabel">秒</div>
                    <div class="tlist" ref="sList" :style="wheelsListStyle" @scroll="onScroll('s', $event)">
                      <button v-for="s in 60" :key="s-1" class="tbtn" :class="{ on: (s-1)===seconds }" @click="scrollToIndex('s', s-1)">{{ pad(s-1) }}</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="actions">
                <button class="btn light" @click="close">取消</button>
                <button class="btn primary" @click="confirm">确定</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { Calendar as CalendarIcon } from 'lucide-vue-next';

const props = defineProps({
  modelValue: { type: String, default: '' }, // 'YYYY-MM-DDTHH:mm'
  placeholder: { type: String, default: '选择日期时间' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'change']);

const open = ref(false);
const root = ref(null);
const dropdown = ref(null);

const now = new Date();
const selected = ref(null);
const hours = ref(9);
const minutes = ref(0);
const seconds = ref(0);
const innerYear = ref(now.getFullYear());
const innerMonth = ref(now.getMonth()); // 0-11

watch(() => props.modelValue, (v) => parseValue(v), { immediate: true });

const display = computed(() => {
  if (!selected.value) return '';
  const d = selected.value;
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(hours.value)}:${pad(minutes.value)}`;
});

function pad(n){ return String(n).padStart(2, '0'); }
function parseValue(v){
  if (!v) { selected.value = null; return; }
  // expect YYYY-MM-DDTHH:mm[:ss]
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const y = +m[1], mo = +m[2]-1, da = +m[3], h = +m[4], mi = +m[5], se = m[6] ? +m[6] : 0;
    const d = new Date(y, mo, da, h, mi, se, 0);
    selected.value = d;
    hours.value = h; minutes.value = mi; seconds.value = se;
    innerYear.value = y; innerMonth.value = mo;
  } else {
    selected.value = null;
  }
}

function isSameDate(a, b){
  if (!a || !b) return false;
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// wheel columns
const calEl = ref(null);
const wheelsBox = ref(null);
const hList = ref(null); const mList = ref(null); const sList = ref(null);
const itemH = 28;
const calHeight = ref(0);
const wheelPad = ref(0);
const wheelsListStyle = computed(() => ({ height: calHeight.value + 'px', paddingTop: wheelPad.value + 'px', paddingBottom: wheelPad.value + 'px' }));

function measure(){
  const h = calEl?.value ? calEl.value.offsetHeight : 0;
  calHeight.value = h;
  wheelPad.value = Math.max(0, Math.floor(h / 2 - itemH / 2));
  nextTick(alignWheels);
}

function setHours(v){ if (typeof v === 'number') hours.value = (v + 24) % 24; }
function setMinutes(v){ if (typeof v === 'number') minutes.value = (v + 60) % 60; }
function setSeconds(v){ if (typeof v === 'number') seconds.value = (v + 60) % 60; }

const aligning = { h: false, m: false, s: false };
const snapTimers = { h: null, m: null, s: null };
function getList(kind){ return kind==='h'?hList.value:kind==='m'?mList.value:sList.value; }
function valueOf(kind){ return kind==='h'?hours.value:kind==='m'?minutes.value:seconds.value; }
function setValue(kind, v){ if (kind==='h') setHours(v); else if (kind==='m') setMinutes(v); else setSeconds(v); }
function scrollToIndex(kind, idx){ const list = getList(kind); if (!list) return; const top = Math.max(0, idx * itemH - wheelPad.value); aligning[kind] = true; list.scrollTo({ top, behavior: 'smooth' }); setTimeout(() => { aligning[kind] = false; setValue(kind, idx); }, 160); }
function alignWheels(){ ['h','m','s'].forEach(k => { const list = getList(k); if (!list) return; const idx = valueOf(k); aligning[k] = true; list.scrollTop = Math.max(0, idx * itemH - wheelPad.value); setTimeout(() => aligning[k] = false, 40); }); }
function onScroll(kind, e){ if (aligning[kind]) return; const list = e.target; const raw = (list.scrollTop + wheelPad.value) / itemH; const idx = Math.round(raw); clearTimeout(snapTimers[kind]); snapTimers[kind] = setTimeout(() => { setValue(kind, idx); aligning[kind] = true; list.scrollTo({ top: Math.max(0, idx * itemH - wheelPad.value), behavior: 'smooth' }); setTimeout(() => aligning[kind] = false, 80); }, 120); }

// calendar
const weekDays = ['日','一','二','三','四','五','六'];
const days = computed(() => {
  const y = innerYear.value; const m = innerMonth.value;
  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const arr = [];
  // prev blanks
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(y, m-1, prevDays - i);
    arr.push({ key: 'p'+i+String(d), date: d, other: true, isToday: isToday(d) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(y, m, i);
    arr.push({ key: 'c'+i, date: d, other: false, isToday: isToday(d) });
  }
  // next to fill 6x7
  while (arr.length % 7 !== 0) {
    const last = arr[arr.length-1].date;
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate()+1);
    arr.push({ key: 'n'+arr.length, date: d, other: true, isToday: isToday(d) });
  }
  // ensure 6 rows
  while (arr.length < 42) {
    const last = arr[arr.length-1].date;
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate()+1);
    arr.push({ key: 'n'+arr.length, date: d, other: true, isToday: isToday(d) });
  }
  return arr;
});
function isToday(d){
  const t = new Date();
  return d.getFullYear()===t.getFullYear() && d.getMonth()===t.getMonth() && d.getDate()===t.getDate();
}
function prevMonth(){ const m = innerMonth.value - 1; if (m < 0) { innerMonth.value = 11; innerYear.value--; } else innerMonth.value = m; }
function nextMonth(){ const m = innerMonth.value + 1; if (m > 11) { innerMonth.value = 0; innerYear.value++; } else innerMonth.value = m; }
function selectDate(d){ selected.value = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours.value, minutes.value, seconds.value, 0); }

function toggle(){ open.value ? close() : openDropdown(); }
function openDropdown(){ if (props.disabled) return; open.value = true; nextTick(() => { positionDropdown(); bindScrollParents(); measure(); alignWheels(); }); }
function close(){ open.value = false; cleanupScrollParents(); }
function confirm(){
  if (!selected.value) {
    const t = new Date();
    const daysInShown = new Date(innerYear.value, innerMonth.value + 1, 0).getDate();
    const day = Math.min(t.getDate(), daysInShown);
    selected.value = new Date(innerYear.value, innerMonth.value, day, hours.value, minutes.value, 0, 0);
  }
  const d = selected.value;
  const v = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(hours.value)}:${pad(minutes.value)}:${pad(seconds.value)}`;
  emit('update:modelValue', v);
  emit('change', v);
  close();
}

function onDocClick(e){
  const r = root.value; const d = dropdown.value;
  if (!r) return;
  if (r.contains(e.target)) return;
  if (d && d.contains(e.target)) return;
  close();
}
function onViewport(){ if (open.value) positionDropdown(); }
onMounted(() => {
  document.addEventListener('click', onDocClick);
  window.addEventListener('scroll', onViewport, { passive: true });
  window.addEventListener('resize', onViewport, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  window.removeEventListener('scroll', onViewport);
  window.removeEventListener('resize', onViewport);
  window.removeEventListener('resize', measure);
  cleanupScrollParents();
});

// dropdown position & scroll parents
const dropdownStyle = reactive({ left: '0px', top: '0px', minWidth: '0px' });
let scrollParents = [];
function getScrollParents(node){
  const parents = []; if (!node) return parents; let p = node.parentElement; const reg = /(auto|scroll|overlay)/;
  while(p && p !== document.body){ const s = getComputedStyle(p); if (reg.test(s.overflowY) || reg.test(s.overflowX)) parents.push(p); p = p.parentElement; }
  parents.push(document.body); return parents;
}
function bindScrollParents(){ cleanupScrollParents(); scrollParents = getScrollParents(root.value); scrollParents.forEach(el => el.addEventListener('scroll', onViewport, { passive:true })); }
function cleanupScrollParents(){ if (scrollParents.length) scrollParents.forEach(el => el.removeEventListener('scroll', onViewport)); scrollParents = []; }
function positionDropdown(){
  const el = root.value; const d = dropdown.value; if (!el || !d) return;
  const rect = el.getBoundingClientRect(); const vw = window.innerWidth; const vh = window.innerHeight;
  const margin = 6; const width = rect.width; let left = rect.left; if (left + width > vw - 4) left = Math.max(4, vw - width - 4);
  const dHeight = d.offsetHeight || 360; let top = rect.bottom + margin;
  if (top + dHeight > vh && rect.top - margin - dHeight > 0) { top = rect.top - margin - dHeight; d.classList.add('drop-up'); } else { d.classList.remove('drop-up'); }
  dropdownStyle.left = left + 'px'; dropdownStyle.top = Math.max(4, top) + 'px'; dropdownStyle.minWidth = width + 'px';
}
</script>

<style scoped>
.ui-dt{ position: relative; width: 300px; font-size: 14px; }
.ui-dt__trigger{ display:flex; align-items:center; gap:8px; height:36px; padding:0 36px 0 12px; background:#fff; border:1px solid var(--c-border); border-radius:10px; box-shadow:0 1px 0 rgba(0,0,0,.02) inset; cursor:pointer; }
.ui-dt__trigger:focus-within{ border-color: var(--c-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
.ui-dt__label{ flex:1 1 auto; color: var(--c-fg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ui-dt__label.is-placeholder{ color: var(--c-dim); }
.ui-dt__icon{ position:absolute; right:10px; top:50%; transform:translateY(-50%); width:18px; height:18px; color:var(--c-dim); pointer-events:none; }

.ui-dt__dropdown{ position:absolute; margin-top:6px; background:#fff; border:1px solid var(--c-border); border-radius:10px; box-shadow: 0 12px 28px rgba(37,99,235,.12); }
.ui-dt__dropdown.portal{ position:fixed; margin-top:0; z-index:5000; }
.ui-dt__dropdown.portal.drop-up{ transform-origin: bottom; }

.ui-dt__head{ display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-bottom:1px solid var(--c-border); }
.ui-dt__head .ym{ font-weight:700; color:#0f172a; }
.ui-dt__head .nav{ width:24px; height:24px; border-radius:6px; border:1px solid var(--c-border); background:#fff; cursor:pointer; }

.ui-dt__content{ display:grid; grid-template-columns: 220px 132px; gap:10px; padding:6px 8px 8px; }
.cal{ width: 220px; }
.ui-dt__week{ display:grid; grid-template-columns: repeat(7, 1fr); gap:3px; padding:0; color:#64748b; font-size:12px; }
.ui-dt__grid{ display:grid; grid-template-columns: repeat(7, 1fr); gap:3px; padding:4px 0 0; }
.cell{ height:28px; border-radius:6px; border:1px solid transparent; background:#fff; cursor:pointer; }
.cell:hover{ background:#eff6ff; }
.cell.today{ border-color:#bfdbfe; }
.cell.sel{ background:#dbeafe; border-color:#93c5fd; color:#1d4ed8; font-weight:700; }
.cell.other{ color:#94a3b8; }

.side{ display:flex; flex-direction:column; gap:8px; min-width: 132px; }
.wheels{ position: relative; border:1px solid var(--c-border); border-radius:10px; background:#fff; padding:6px; overflow:hidden; }
.selbar{ position:absolute; left:8px; right:8px; top:50%; transform: translateY(-50%); height:28px; border:1px solid #93c5fd; border-radius:6px; pointer-events:none; box-shadow: inset 0 0 0 1px rgba(59,130,246,.15); }
.cols{ display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; align-items:stretch; }
.col{ display:flex; flex-direction:column; min-width:0; }
.tlabel{ color:#64748b; font-size:12px; margin-bottom:4px; }
.tlist{ border:1px solid var(--c-border); border-radius:10px; background:#fff; padding:4px; height: 100%; overflow:auto; scroll-behavior: smooth; }
.tbtn{ display:block; width:100%; text-align:center; height:28px; line-height:26px; border-radius:6px; border:1px solid transparent; background:#fff; cursor:pointer; color:#0f172a; font-size:13px; }
.tbtn:hover{ background:#eff6ff; }
.tbtn.on{ background:#dbeafe; border-color:#93c5fd; color:#1d4ed8; font-weight:700; }

.actions{ display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top: 2px; }
.btn{ height:30px; border-radius:8px; padding:0 10px; border:1px solid var(--c-border); cursor:pointer; white-space: nowrap; font-size: 13px; }
.btn.primary{ background: var(--c-primary); color:#fff; border-color:transparent; box-shadow: 0 6px 16px rgba(37,99,235,.25); }
.btn.light{ background:#fff; color:var(--c-fg); }

.fade-slide-enter-active, .fade-slide-leave-active { transition: opacity .14s ease, transform .14s ease; transform-origin: top; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity:0; transform: translateY(-4px) scaleY(.98); }
</style>
