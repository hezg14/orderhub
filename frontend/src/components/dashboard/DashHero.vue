<script setup lang="ts">
import { useCountUp } from '@/composables/useCountUp';
import { currentLocale, localName, useI18n } from '@/i18n';
import type { DashboardCharts, DashboardStats, Order } from '@/types';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { fmtMoney } from '@/utils/format';

/**
 * The hero deck: live clock, counting month revenue, self-drawing sparkline
 * and the order tape. Extracted from Dashboard.vue — it owns its own clocks
 * and animation timers so the parent stays a data orchestrator.
 */
const props = defineProps<{
  stats: DashboardStats | null;
  trend: DashboardCharts['trend'];
  recent: Order[];
  loading: boolean;
  range: 'week' | 'month' | 'quarter';
}>();

const { t } = useI18n();

const locale = computed(() => (currentLocale() === 'zh' ? 'zh-CN' : 'en-US'));

/* Growth over +999% reads as fake seed data, not insight — clamp for trust. */
const clampDelta = (d: number | null) =>
  d === null ? null : Math.max(-99, Math.min(999, Math.round(d * 10) / 10));

const clampedDelta = computed(() => clampDelta(props.stats?.monthRevenueDelta ?? null));

const heroCells = computed(() => [
  { key: 'today', label: t('dashboard.todayOrders'), value: String(props.stats?.todayOrders ?? 0) },
  { key: 'amount', label: t('dashboard.todayRevenue'), value: `¥${fmtMoney(props.stats?.todayAmount ?? 0)}` },
  { key: 'toship', label: t('dashboard.toShip'), value: String(props.stats?.toShip ?? 0) },
]);

/** A ticking clock is what makes a dashboard feel like a console. */
const now = ref(new Date());
let clockTimer: number | undefined;

onMounted(() => {
  clockTimer = window.setInterval(() => (now.value = new Date()), 1000);
});
onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer);
});

const heroRevenue = useCountUp(computed(() => props.stats?.monthRevenue ?? null));

const heroRevenueText = computed(() =>
  heroRevenue.value.toLocaleString(locale.value, { maximumFractionDigits: 0 }),
);

const clock = computed(() =>
  now.value.toLocaleTimeString(locale.value === 'zh-CN' ? 'zh-CN' : 'en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }),
);

const heroDate = computed(() =>
  now.value.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }),
);

/** Sparkline geometry built from the trend series in a fixed 320×76 box. */
const spark = computed(() => {
  const values = props.trend.map((d) => d.value);
  if (values.length < 2) return null;

  const W = 320;
  const H = 76;
  const P = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => ({
    x: P + (i / (values.length - 1)) * (W - P * 2),
    y: H - P - ((v - min) / span) * (H - P * 2),
  }));

  // Horizontal control points keep the curve smooth without overshoot.
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const mid = (a.x + b.x) / 2;
    line +=
      ` C ${mid.toFixed(1)} ${a.y.toFixed(1)},` +
      ` ${mid.toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }

  const last = pts[pts.length - 1];
  const first = pts[0];
  return {
    line,
    area: `${line} L ${last.x.toFixed(1)} ${H} L ${first.x.toFixed(1)} ${H} Z`,
    last,
  };
});

/** The marquee renders the list twice so it can loop seamlessly at -50%. */
const tickerOrders = computed(() => props.recent.slice(0, 8));
</script>

<template>
  <section class="hero">
    <div class="hero-deco" aria-hidden="true">
      <svg class="hero-route" viewBox="0 0 620 200" preserveAspectRatio="none">
        <path
          class="hero-route-path"
          d="M-10 168C110 168 150 44 300 44S500 150 630 96"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-dasharray="5 9"
        />
      </svg>
      <span class="hero-glow" />
      <!-- Viewfinder brackets: the deck is framed like an instrument panel. -->
      <span class="hud tl" />
      <span class="hud tr" />
      <span class="hud bl" />
      <span class="hud br" />
    </div>

    <div class="hero-body">
      <div class="hero-main">
        <div class="hero-kicker">
          <span class="pulse" />
          <span class="mono hero-clock">{{ clock }}</span>
          <span class="hero-sep">/</span>
          <span class="hero-date">{{ heroDate }}</span>
          <span class="hero-tag">{{ t('dashboard.live') }}</span>
        </div>

        <div class="hero-figure figures">
          <span class="hero-cur">¥</span>{{ loading ? '—' : heroRevenueText }}
        </div>

        <div class="hero-meta">
          <span class="hero-label">{{ t('dashboard.monthRevenue') }}</span>
          <span
            v-if="clampedDelta !== null"
            class="hero-delta"
            :class="clampedDelta >= 0 ? 'up' : 'down'"
          >
            {{ clampedDelta >= 0 ? '▲' : '▼' }} {{ Math.abs(clampedDelta) }}%
          </span>
          <span class="hero-dim">{{ t('dashboard.vsLastMonth') }}</span>
        </div>
      </div>

      <div v-if="spark" :key="range" class="hero-spark">
        <svg viewBox="0 0 320 76" preserveAspectRatio="none">
          <defs>
            <linearGradient id="heroSparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="spark.area" fill="url(#heroSparkFill)" />
          <path
            class="spark-line"
            :d="spark.line"
            fill="none"
            stroke="#ffffff"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            pathLength="100"
          />
          <circle :cx="spark.last.x" :cy="spark.last.y" r="3.2" fill="#ffffff" />
        </svg>
        <span class="spark-cap">{{ t(`dashboard.range.${range}`) }}</span>
      </div>

      <div class="hero-cells">
        <div v-for="c in heroCells" :key="c.key" class="hero-cell">
          <span class="cell-k">{{ c.label }}</span>
          <span class="cell-v figures">{{ c.value }}</span>
        </div>
      </div>
    </div>

    <div v-if="tickerOrders.length" class="hero-ticker">
      <span class="ticker-tag">
        <span class="pulse pulse-sm" />{{ t('dashboard.recentOrders') }}
      </span>
      <div class="ticker-mask">
        <div class="ticker-track">
          <div v-for="half in 2" :key="half" class="ticker-half" :aria-hidden="half === 2">
            <span v-for="o in tickerOrders" :key="o.id" class="ticker-item">
              <b class="mono">{{ o.orderNo }}</b>
              <i>{{ o.customer ? localName(o.customer) : '—' }}</i>
              <em class="mono">¥{{ fmtMoney(o.total) }}</em>
              <span class="ticker-st">{{ t(`status.${o.status}`) }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin-bottom: var(--s-4);
  border-radius: 14px;
  background: var(--hero-bg);
  border: 1px solid var(--hero-border);
  color: var(--hero-fg);
  box-shadow: 0 14px 34px rgb(24 20 66 / 24%);
  animation: deck-rise 0.45s var(--ease) both;
}

@keyframes deck-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.hero-deco {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  /* Faint engineering grid inside the deck — texture, not decoration. */
  background-image: linear-gradient(to right, var(--hero-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--hero-grid) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(115deg, #000 0%, #000 55%, transparent 100%);
}

.hero-route {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: var(--hero-line);
}

/* The dashed route drifts slowly: the diagram is alive, not printed. */
.hero-route-path {
  animation: route-march 26s linear infinite;
}

@keyframes route-march {
  to {
    stroke-dashoffset: -140;
  }
}

/* Four corner brackets — a camera/viewfinder frame around the readout. */
.hud {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 0 solid var(--hero-hud);
}

.hud.tl {
  top: 9px;
  left: 9px;
  border-top-width: 1.5px;
  border-left-width: 1.5px;
}

.hud.tr {
  top: 9px;
  right: 9px;
  border-top-width: 1.5px;
  border-right-width: 1.5px;
}

.hud.bl {
  bottom: 9px;
  left: 9px;
  border-bottom-width: 1.5px;
  border-left-width: 1.5px;
}

.hud.br {
  bottom: 9px;
  right: 9px;
  border-bottom-width: 1.5px;
  border-right-width: 1.5px;
}

.hero-glow {
  position: absolute;
  top: -300px;
  right: -120px;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(129 140 248 / 40%), transparent 62%);
}

.hero-body {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(230px, 1.15fr) minmax(170px, 0.95fr) minmax(190px, 0.8fr);
  gap: var(--s-6);
  align-items: end;
  padding: 18px 22px 16px;
}

.hero-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hero-fg-dim);
}

.hero-clock {
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--hero-fg);
}

.hero-sep {
  opacity: 0.4;
}

.hero-tag {
  margin-left: 3px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #a7f3d0;
  background: rgb(16 185 129 / 18%);
  border: 1px solid rgb(52 211 153 / 30%);
}

.pulse {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 0 0 rgb(74 222 128 / 70%);
  animation: pulse 2.2s infinite;
}

.pulse-sm {
  width: 5px;
  height: 5px;
}

@keyframes pulse {
  70% {
    box-shadow: 0 0 0 7px rgb(74 222 128 / 0%);
  }
  100% {
    box-shadow: 0 0 0 0 rgb(74 222 128 / 0%);
  }
}

.hero-figure {
  margin-top: 10px;
  font-size: clamp(30px, 3.2vw, 44px);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.04em;
  white-space: nowrap;
  text-shadow: 0 2px 26px rgb(129 140 248 / 45%);
}

.hero-cur {
  margin-right: 4px;
  font-size: 0.5em;
  font-weight: 500;
  vertical-align: 0.3em;
  color: var(--hero-fg-dim);
}

.hero-meta {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-top: 9px;
  font-size: 11.5px;
  color: var(--hero-fg-dim);
}

.hero-delta {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hero-delta.up {
  color: #4ade80;
}

.hero-delta.down {
  color: #fca5a5;
}

.hero-dim {
  opacity: 0.7;
}

.hero-spark {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hero-spark svg {
  display: block;
  width: 100%;
  height: 76px;
  overflow: visible;
}

/* The line draws itself once per range change. */
.spark-line {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: spark-draw 1.3s var(--ease) forwards;
}

@keyframes spark-draw {
  to {
    stroke-dashoffset: 0;
  }
}

.spark-cap {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hero-fg-dim);
  opacity: 0.75;
}

/* Readouts stack vertically like a rack of instruments: label left, figure
   right. Horizontal cells truncate long labels at this width. */
.hero-cells {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.hero-cell {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 5px 9px;
  border-radius: 7px;
  background: var(--hero-cell-bg);
  border: 1px solid var(--hero-cell-border);
}

.cell-k {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hero-fg-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-v {
  flex: none;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--hero-fg);
  white-space: nowrap;
}

.hero-ticker {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 22px;
  border-top: 1px solid var(--hero-line);
  background: rgb(0 0 0 / 16%);
  font-size: 11px;
}

.ticker-tag {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hero-fg-dim);
}

.ticker-mask {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent);
}

.ticker-track {
  display: flex;
  width: max-content;
  animation: ticker 46s linear infinite;
}

.hero-ticker:hover .ticker-track {
  animation-play-state: paused;
}

.ticker-half {
  display: flex;
  gap: 26px;
  padding-right: 26px;
}

.ticker-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  color: var(--hero-fg-dim);
}

.ticker-item b {
  font-weight: 500;
  color: var(--hero-fg);
}

.ticker-item i {
  font-style: normal;
  opacity: 0.85;
}

.ticker-item em {
  font-style: normal;
  color: #a5b4fc;
}

.ticker-st {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  background: var(--hero-cell-bg);
  border: 1px solid var(--hero-cell-border);
}

@keyframes ticker {
  to {
    transform: translateX(-50%);
  }
}

@media (max-width: 1180px) {
  /* Hero reflows before it starts clipping: figures left, spark right,
     the three cells drop to their own full-width row. */
  .hero-body {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    row-gap: var(--s-4);
  }

  .hero-cells {
    grid-column: 1 / -1;
    flex-direction: row;
  }

  .hero-cell {
    flex: 1 1 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
}

@media (max-width: 767px) {
  .hero-body {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px;
  }

  /* The sparkline is a bonus, not information — drop it rather than squeeze it. */
  .hero-spark {
    display: none;
  }

  /* Keep the rack vertical on phones: three equal columns squeeze the labels
     into unreadable stubs. Label left, figure right — same as desktop. */
  .hero-cells {
    flex-flow: column nowrap;
  }

  .hero-cell {
    flex: none;
    width: 100%;
    gap: 10px;
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }

  .hero-ticker {
    padding: 7px 16px;
  }
}
</style>
