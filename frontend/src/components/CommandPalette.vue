<script setup lang="ts">
import { dashboardApi } from '@/api';
import { navFor } from '@/config/navigation';
import { useApiTelemetry } from '@/composables/useApiTelemetry';
import { useCommandPalette } from '@/composables/useCommandPalette';
import { useLogout } from '@/composables/useLogout';
import { useTheme } from '@/composables/useTheme';
import { currentLocale, localName, setLocale, useI18n, type AppLocale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import type { Order } from '@/types';
import { bestMatchScore } from '@/utils/matchScore';
import {
  Box,
  Moon,
  Plus,
  Search,
  Sunny,
  Switch,
  SwitchButton,
} from '@element-plus/icons-vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue';
import { useRouter } from 'vue-router';

/**
 * Command palette — ⌘K / Ctrl-K.
 *
 * One input that reaches every page, the frequent actions and the most recent
 * orders. This is the difference between an app you click through and one you
 * operate: keyboard-first, no pointer round-trips.
 */

type Group = 'nav' | 'action' | 'order' | 'result';

interface Item {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  meta?: string;
  keywords?: string;
  icon: Component;
  run: () => void;
}

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const { open, hide, toggle } = useCommandPalette();
const { theme, toggle: toggleTheme } = useTheme();
const { confirmLogout } = useLogout();
const { latency } = useApiTelemetry();

const query = ref('');
const activeIndex = ref(0);
const inputEl = ref<HTMLInputElement | null>(null);

/* ------------------------------------------------------------------ items */

const navItems = computed<Item[]>(() =>
  navFor(auth.isAdmin).map((n) => ({
    id: `nav:${n.path}`,
    group: 'nav' as const,
    label: t(n.labelKey),
    meta: n.path,
    keywords: n.keywords,
    icon: n.icon,
    run: () => router.push(n.path),
  })),
);

const actionItems = computed<Item[]>(() => {
  const other: AppLocale = currentLocale() === 'zh' ? 'en' : 'zh';
  return [
    {
      id: 'act:new-order',
      group: 'action' as const,
      label: t('palette.actionNewOrder'),
      meta: 'N',
      keywords: 'new create order 新建 创建 订单',
      icon: Plus,
      run: () => router.push('/orders/new'),
    },
    {
      id: 'act:theme',
      group: 'action' as const,
      label: t('palette.actionTheme'),
      meta: theme.value === 'dark' ? t('common.themeDark') : t('common.themeLight'),
      keywords: 'theme dark light mode 主题 深色 浅色',
      icon: theme.value === 'dark' ? Sunny : Moon,
      run: toggleTheme,
    },
    {
      id: 'act:locale',
      group: 'action' as const,
      label: t('palette.actionLocale'),
      meta: other === 'zh' ? '中文' : 'EN',
      keywords: 'language locale 语言 中文 english',
      icon: Switch,
      run: () => setLocale(other),
    },
    {
      id: 'act:logout',
      group: 'action' as const,
      label: t('palette.actionLogout'),
      keywords: 'logout sign out 退出 登出',
      icon: SwitchButton,
      run: () => void confirmLogout(),
    },
  ];
});

const orderItems = ref<Item[]>([]);
let ordersRequested = false;

async function loadOrders() {
  if (ordersRequested) return;
  ordersRequested = true;
  try {
    const list: Order[] = await dashboardApi.recentOrders();
    orderItems.value = list.slice(0, 6).map((o) => ({
      id: `order:${o.id}`,
      group: 'order' as const,
      label: o.orderNo,
      hint: o.customer ? localName(o.customer) : '',
      meta: `¥${o.total.toLocaleString(currentLocale() === 'zh' ? 'zh-CN' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      keywords: `${o.orderNo} ${o.customer ? localName(o.customer) : ''}`,
      icon: Box,
      run: () => router.push(`/orders/${o.id}`),
    }));
  } catch {
    // A failed fetch must not break the palette — the other groups still work.
    ordersRequested = false;
  }
}

/* --------------------------------------------------------------- matching */

const results = computed<{ item: Item; group: Group }[]>(() => {
  const q = query.value.trim();
  const all = [...navItems.value, ...actionItems.value, ...orderItems.value];

  if (!q) return all.map((item) => ({ item, group: item.group }));

  return all
    .map((item) => ({
      item,
      best: bestMatchScore(q, { label: item.label, keywords: item.keywords, meta: item.meta }),
    }))
    .filter((row) => row.best >= 0)
    .sort((a, b) => b.best - a.best)
    .map((row) => ({ item: row.item, group: 'result' as const }));
});

const groups = computed(() => {
  const out: { key: Group; label: string; rows: { item: Item; idx: number }[] }[] = [];
  let idx = 0;
  for (const r of results.value) {
    const last = out[out.length - 1];
    const row = { item: r.item, idx: idx++ };
    if (last && last.key === r.group) last.rows.push(row);
    else out.push({ key: r.group, label: groupLabel(r.group), rows: [row] });
  }
  return out;
});

function groupLabel(g: Group): string {
  if (g === 'nav') return t('palette.groupNav');
  if (g === 'action') return t('palette.groupActions');
  if (g === 'order') return t('palette.groupOrders');
  return t('palette.groupResults');
}

const flat = computed(() => results.value.map((r) => r.item));

watch(results, () => {
  activeIndex.value = 0;
});

/* ------------------------------------------------------------- behaviour */

function move(delta: number) {
  const n = flat.value.length;
  if (!n) return;
  activeIndex.value = (activeIndex.value + delta + n) % n;
  nextTick(() => {
    document.getElementById(`palette-row-${activeIndex.value}`)?.scrollIntoView({ block: 'nearest' });
  });
}

function run(item: Item | undefined) {
  if (!item) return;
  hide();
  // Let the closing frame paint before the route swap: otherwise the palette's
  // fade competes with the page transition and both look like a stutter.
  requestAnimationFrame(() => item.run());
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    move(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    move(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    run(flat.value[activeIndex.value]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    hide();
  }
}

function onGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    toggle();
    return;
  }
  if (e.key === 'Escape' && open.value) hide();
}

watch(open, async (isOpen) => {
  document.body.classList.toggle('no-scroll', isOpen);
  if (!isOpen) return;
  query.value = '';
  activeIndex.value = 0;
  void loadOrders();
  await nextTick();
  inputEl.value?.focus();
});

onMounted(() => window.addEventListener('keydown', onGlobalKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey);
  document.body.classList.remove('no-scroll');
});
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="open" class="scrim" @mousedown.self="hide">
        <div class="panel" role="dialog" aria-modal="true" :aria-label="t('palette.title')">
          <div class="p-head">
            <el-icon class="p-icon" :size="16"><Search /></el-icon>
            <input
              ref="inputEl"
              v-model="query"
              class="p-input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :placeholder="t('palette.placeholder')"
              @keydown="onKeydown"
            >
            <kbd class="kbd">ESC</kbd>
          </div>

          <div class="p-body">
            <template v-for="g in groups" :key="g.key">
              <div class="p-group">
                <span>{{ g.label }}</span>
                <span class="p-count mono">{{ g.rows.length }}</span>
              </div>
              <button
                v-for="row in g.rows"
                :id="`palette-row-${row.idx}`"
                :key="row.item.id"
                class="p-row"
                :class="{ 'is-active': row.idx === activeIndex }"
                type="button"
                @mousemove="activeIndex = row.idx"
                @click="run(row.item)"
              >
                <span class="r-icon">
                  <el-icon :size="14"><component :is="row.item.icon" /></el-icon>
                </span>
                <span class="r-text">
                  <span class="r-label">{{ row.item.label }}</span>
                  <span v-if="row.item.hint" class="r-hint">{{ row.item.hint }}</span>
                </span>
                <span v-if="row.item.meta" class="r-meta mono">{{ row.item.meta }}</span>
              </button>
            </template>

            <div v-if="!flat.length" class="p-empty">
              <div class="p-empty-title">{{ t('palette.empty') }}</div>
              <div class="p-empty-hint">{{ t('palette.emptyHint') }}</div>
            </div>
          </div>

          <div class="p-foot">
            <span class="f-hint"><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd>{{ t('palette.footMove') }}</span>
            <span class="f-hint"><kbd class="kbd">↵</kbd>{{ t('palette.footOpen') }}</span>
            <span class="f-hint"><kbd class="kbd">esc</kbd>{{ t('palette.footClose') }}</span>
            <span class="f-spacer" />
            <span class="f-stat mono">
              <i class="dot" :class="{ ok: latency !== null }" />
              {{ latency === null ? '—' : `${latency}ms` }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 10vh 16px 16px;
  background: var(--palette-scrim);
  backdrop-filter: blur(6px);
}

.panel {
  width: min(660px, 100%);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-card);
  box-shadow: var(--shadow-overlay);
}

.p-head {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 54px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border-light);
}

.p-icon {
  color: var(--text-disabled);
}

.p-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 15px;
}

.p-input::placeholder {
  color: var(--text-disabled);
}

.p-body {
  max-height: min(66vh, 620px);
  overflow-y: auto;
  padding: 5px 6px 7px;
}

.p-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px 1px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-disabled);
}

.p-count {
  opacity: 0.7;
}

.p-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 5px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
}

.p-row.is-active {
  background: var(--bg-hover);
  box-shadow: inset 2px 0 0 var(--primary);
}

.r-icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--bg-inset);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.p-row.is-active .r-icon {
  background: var(--primary-bg);
  color: var(--primary);
  border-color: var(--primary-border);
}

.r-text {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.r-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.r-hint {
  font-size: 11px;
  color: var(--text-disabled);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.r-meta {
  font-size: 10.5px;
  color: var(--text-disabled);
  white-space: nowrap;
}

.p-empty {
  padding: 26px 14px 30px;
  text-align: center;
}

.p-empty-title {
  font-size: 13px;
  color: var(--text-secondary);
}

.p-empty-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-disabled);
}

.p-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 32px;
  padding: 0 12px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-subtle);
  font-size: 10.5px;
  color: var(--text-disabled);
}

.f-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.f-spacer {
  flex: 1;
}

.f-stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-disabled);
}

.dot.ok {
  background: var(--success);
}

/* Motion: the scrim fades, the panel drops in — two speeds, one gesture. */
.palette-enter-active,
.palette-leave-active {
  transition: opacity 0.15s var(--ease);
}

.palette-enter-active .panel,
.palette-leave-active .panel {
  transition: transform 0.18s var(--ease);
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}

.palette-enter-from .panel {
  transform: translateY(-10px) scale(0.985);
}

.palette-leave-to .panel {
  transform: translateY(-6px) scale(0.99);
}

@media (max-width: 640px) {
  .scrim {
    padding: 6vh 10px 10px;
  }

  .p-foot {
    gap: 10px;
  }

  .f-hint:nth-child(2) {
    display: none;
  }
}
</style>
