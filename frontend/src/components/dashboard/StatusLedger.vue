<script setup lang="ts">
import BaseChart, { type ChartOption } from '@/components/BaseChart.vue';
import { useTheme } from '@/composables/useTheme';
import { chartInk, statusPalette } from '@/config/chartTheme';
import { useI18n } from '@/i18n';
import type { DashboardCharts, OrderStatus } from '@/types';
import { computed } from 'vue';

/**
 * Card 02: the status ring + ledger. The ring shows shape, the ledger shows
 * numbers — a terminal pairs a gauge with a readout for exactly this reason.
 */
const props = defineProps<{
  byStatus: DashboardCharts['byStatus'];
}>();

const { t } = useI18n();
const { theme } = useTheme();

const ink = computed(() => chartInk(theme.value));

const statusOption = computed<ChartOption>(() => {
  const palette = statusPalette(theme.value);
  const data = props.byStatus.map((s) => ({
    name: t(`status.${s.status}`),
    value: s.count,
    itemStyle: { color: palette[s.status] },
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['60%', '82%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: ink.value.border, borderWidth: 2 },
        label: {
          show: true,
          position: 'center',
          formatter: () => `{v|${total}}\n{t|${t('dashboard.orderCount')}}`,
          rich: {
            v: { fontSize: 24, fontWeight: 700, color: ink.value.title, lineHeight: 30 },
            t: { fontSize: 11, color: ink.value.label },
          },
        },
        emphasis: { scale: true, scaleSize: 4, label: { show: true } },
        data,
      },
    ],
  };
});

const statusRows = computed(() => {
  const palette = statusPalette(theme.value);
  const order: OrderStatus[] = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
  const list = [...props.byStatus].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status),
  );
  const total = list.reduce((sum, d) => sum + d.count, 0) || 1;
  return list.map((d) => ({
    key: d.status,
    label: t(`status.${d.status}`),
    count: d.count,
    pct: Math.round((d.count / total) * 100),
    color: palette[d.status],
  }));
});
</script>

<template>
  <div>
    <BaseChart :option="statusOption" :height="188" />
    <ul class="status-rows">
      <li v-for="row in statusRows" :key="row.key">
        <span class="sr-dot" :style="{ background: row.color }" />
        <span class="sr-label">{{ row.label }}</span>
        <span class="sr-count mono">{{ row.count }}</span>
        <span class="sr-pct mono">{{ row.pct }}%</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.status-rows {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--border-light);
}

.status-rows li {
  display: grid;
  grid-template-columns: 6px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 5px 2px;
  border-bottom: 1px solid var(--border-light);
}

.status-rows li:last-child {
  border-bottom: 0;
}

.sr-dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgb(15 18 30 / 10%);
}

.sr-label {
  font-size: 11.5px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sr-count {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 20px;
  text-align: right;
}

.sr-pct {
  font-size: 10.5px;
  color: var(--text-disabled);
  min-width: 30px;
  text-align: right;
}
</style>
