<script setup lang="ts">
import { localName } from '@/i18n';
import type { DashboardCharts } from '@/types';
import { computed } from 'vue';

/**
 * Top-5 as a ranked list instead of a bar chart: the top three get medal
 * treatment (the "ranking numeral" pattern), quantities render as CSS bars —
 * more scannable and more on-brand than an ECharts axis for five items.
 */
const props = defineProps<{
  topProducts: DashboardCharts['topProducts'];
}>();

const ranked = computed(() => {
  const list = props.topProducts;
  const max = Math.max(1, ...list.map((p) => p.quantity));
  return list.map((p, i) => ({
    ...p,
    displayName: localName(p),
    rank: i + 1,
    pct: Math.max(6, Math.round((p.quantity / max) * 100)),
  }));
});
</script>

<template>
  <ol class="rank-list">
    <li v-for="p in ranked" :key="p.rank" class="rank-row">
      <span class="medal" :class="`m${p.rank}`">{{ p.rank }}</span>
      <div class="rank-main">
        <div class="rank-name" :title="p.displayName">{{ p.displayName }}</div>
        <div class="rank-bar"><i :style="{ width: `${p.pct}%` }" /></div>
      </div>
      <span class="rank-qty tabular">{{ p.quantity }}</span>
    </li>
  </ol>
</template>

<style scoped>
.rank-list {
  list-style: none;
  margin: 0;
  padding: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 6px;
  margin: -4px -6px;
  border-radius: var(--r-control);
  transition: background var(--t-fast) var(--ease);
}

.rank-row:hover {
  background: var(--bg-hover);
}

.medal {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-hover);
}

/* Quiet rank badges: a hint of podium tint, no gradients, no glow. */
.medal.m1 {
  color: #92400e;
  background: var(--warning-bg);
}

.medal.m2 {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.medal.m3 {
  color: #9a3412;
  background: rgb(251 146 60 / 10%);
}

html.dark .medal.m1 {
  color: #fbbf24;
}

html.dark .medal.m3 {
  color: #fdba74;
  background: rgb(251 146 60 / 12%);
}

.rank-main {
  flex: 1;
  min-width: 0;
}

.rank-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-bar {
  margin-top: 6px;
  height: 6px;
  border-radius: 99px;
  background: var(--bg-inset);
  overflow: hidden;
}

.rank-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--primary);
  opacity: 0.75;
  transition: width 0.6s var(--ease);
}

.rank-qty {
  flex: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 40px;
  text-align: right;
}
</style>
