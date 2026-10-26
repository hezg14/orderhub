<script setup lang="ts">
import BaseChart, { type ChartOption } from '@/components/BaseChart.vue';
import { useTheme } from '@/composables/useTheme';
import { brandColor, chartInk } from '@/config/chartTheme';
import { computed } from 'vue';

/** Card 01: the revenue trend line with a soft brand-tinted area. */
const props = defineProps<{
  trend: { label: string; value: number; orders: number }[];
}>();

const { theme } = useTheme();

const ink = computed(() => chartInk(theme.value));
const brand = computed(() => brandColor(theme.value));

const trendOption = computed<ChartOption>(() => {
  const data = props.trend;
  return {
    grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: ink.value.axis } },
      valueFormatter: (v) => `¥${Number(v).toLocaleString()}`,
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      boundaryGap: false,
      axisLine: { lineStyle: { color: ink.value.axis } },
      axisTick: { show: false },
      axisLabel: { color: ink.value.label, fontSize: 11, interval: Math.max(0, Math.floor(data.length / 8)) },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: ink.value.grid } },
      axisLabel: {
        color: ink.value.label,
        fontSize: 11,
        formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)),
      },
    },
    series: [
      {
        type: 'line',
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 0,
        showSymbol: false,
        data: data.map((d) => d.value),
        lineStyle: { width: 2, color: brand.value },
        itemStyle: { color: brand.value },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: theme.value === 'dark' ? 'rgba(129,140,248,0.14)' : 'rgba(79,70,229,0.10)' },
              { offset: 1, color: 'rgba(79,70,229,0)' },
            ],
          },
        },
      },
    ],
  };
});
</script>

<template>
  <BaseChart :option="trendOption" :height="300" />
</template>
