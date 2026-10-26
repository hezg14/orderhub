<script setup lang="ts">
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

/**
 * ECharts is imported through echarts/core with explicit registration so that
 * only line/bar/pie + grid/tooltip/legend end up in the bundle (~105 KB gzip
 * instead of ~330 KB for the full build).
 */
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

export type ChartOption = echarts.ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>;

const props = withDefaults(defineProps<{ option: ChartOption; height?: number }>(), { height: 280 });

const el = ref<HTMLDivElement>();
const chart = shallowRef<echarts.ECharts>();
let observer: ResizeObserver | undefined;

onMounted(() => {
  if (!el.value) return;
  chart.value = echarts.init(el.value, undefined, { renderer: 'canvas' });
  chart.value.setOption(props.option);

  // ResizeObserver instead of window.resize: the sidebar collapse and drawer
  // open also change the chart width without firing a window resize.
  observer = new ResizeObserver(() => chart.value?.resize());
  observer.observe(el.value);
});

watch(
  () => props.option,
  (next) => chart.value?.setOption(next, { notMerge: true }),
  { deep: true },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  chart.value?.dispose();
});
</script>

<template>
  <div ref="el" class="chart" :style="{ height: `${height}px` }" />
</template>

<style scoped>
.chart {
  width: 100%;
}
</style>
