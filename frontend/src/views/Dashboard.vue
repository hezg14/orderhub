<script setup lang="ts">
import { dashboardApi } from '@/api';
import DashHero from '@/components/dashboard/DashHero.vue';
import RecentOrders from '@/components/dashboard/RecentOrders.vue';
import StatusLedger from '@/components/dashboard/StatusLedger.vue';
import TopProductsRank from '@/components/dashboard/TopProductsRank.vue';
import TrendChart from '@/components/dashboard/TrendChart.vue';
import StatCard from '@/components/StatCard.vue';
import { useI18n } from '@/i18n';
import type { DashboardCharts, DashboardStats, Order } from '@/types';
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { fmtCompact, fmtMoney } from '@/utils/format';

/**
 * The dashboard page is a data orchestrator: it owns the range state, the
 * three API calls and the KPI/insight derivations. Rendering lives in
 * `components/dashboard/*` — the hero deck, the two chart cards, the rank
 * list and the recent-orders table are self-contained with their own styles.
 */
const { t } = useI18n();
const router = useRouter();

const range = ref<'week' | 'month' | 'quarter'>('month');
const stats = ref<DashboardStats | null>(null);
const charts = ref<DashboardCharts | null>(null);
const recent = ref<Order[]>([]);
const loading = ref(true);
const failed = ref(false);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const [s, c, r] = await Promise.all([
      dashboardApi.stats(range.value),
      dashboardApi.charts(range.value),
      dashboardApi.recentOrders(),
    ]);
    stats.value = s;
    charts.value = c;
    recent.value = r;
  } catch {
    failed.value = true;
    ElMessage.error(t('dashboard.loadFailed'));
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(range, load);

/* ------------------------------------------------------------------- kpis */

/* Growth over +999% reads as fake seed data, not insight — clamp for trust. */
const clampDelta = (d: number | null) =>
  d === null ? null : Math.max(-99, Math.min(999, Math.round(d * 10) / 10));

const kpis = computed(() => [
  {
    key: 'today',
    label: t('dashboard.todayOrders'),
    value: String(stats.value?.todayOrders ?? 0),
    numeric: stats.value?.todayOrders ?? null,
    prefix: '',
    decimals: 0,
    suffix: t('dashboard.ordersUnit'),
    delta: null,
    deltaLabel: '',
    hint: `¥${fmtMoney(stats.value?.todayAmount ?? 0)}`,
    to: '/orders',
  },
  {
    key: 'revenue',
    label: t('dashboard.monthRevenue'),
    value: `¥${fmtCompact(stats.value?.monthRevenue ?? 0)}`,
    numeric: stats.value?.monthRevenue ?? null,
    prefix: '¥',
    decimals: 0,
    suffix: '',
    delta: clampDelta(stats.value?.monthRevenueDelta ?? null),
    deltaLabel: t('dashboard.vsLastMonth'),
    hint: '',
    to: '/reports',
  },
  {
    key: 'toship',
    label: t('dashboard.toShip'),
    value: String(stats.value?.toShip ?? 0),
    numeric: stats.value?.toShip ?? null,
    prefix: '',
    decimals: 0,
    suffix: t('dashboard.ordersUnit'),
    delta: null,
    deltaLabel: '',
    hint: t('dashboard.awaitingOut', { amount: `¥${fmtMoney(stats.value?.toShipAmount ?? 0)}` }),
    to: '/orders?status=paid',
    accent: 'warning' as const,
  },
  {
    key: 'customers',
    label: t('dashboard.activeCustomers'),
    value: String(stats.value?.activeCustomers ?? 0),
    numeric: stats.value?.activeCustomers ?? null,
    prefix: '',
    decimals: 0,
    suffix: t('dashboard.customersUnit'),
    delta: null,
    deltaLabel: '',
    hint: t('dashboard.ofTotalCustomers', { total: stats.value?.totalCustomers ?? 0 }),
    to: '/customers',
  },
]);

/* --------------------------------------------------------------- insights */

/**
 * Content-driven insights: rules read the same data the charts use and compose
 * natural-language micro-cards that deep-link to the relevant screen. No AI
 * backend — just the GenUI idea that the UI should be assembled from what the
 * data is saying right now.
 */
const insights = computed(() => {
  const out: { text: string; to: string; tone: 'brand' | 'warning' }[] = [];

  const trend = charts.value?.trend ?? [];
  if (trend.length > 0) {
    const peak = trend.reduce((a, b) => (b.value > a.value ? b : a));
    const total = trend.reduce((s, d) => s + d.value, 0);
    if (peak.value > 0 && total > 0) {
      out.push({
        text: t('dashboard.insightPeak', {
          day: peak.label,
          amount: `¥${fmtMoney(peak.value)}`,
          pct: Math.round((peak.value / total) * 100),
        }),
        to: '/reports',
        tone: 'brand',
      });
    }
  }

  const by = charts.value?.byStatus ?? [];
  const totalOrders = by.reduce((s, d) => s + d.count, 0);
  const pending = by.find((d) => d.status === 'pending')?.count ?? 0;
  if (totalOrders > 0 && pending > 0) {
    out.push({
      text: t('dashboard.insightPending', {
        n: pending,
        pct: Math.round((pending / totalOrders) * 100),
      }),
      to: '/orders?status=pending',
      tone: pending > totalOrders * 0.2 ? 'warning' : 'brand',
    });
  }

  const toShip = stats.value?.toShip ?? 0;
  if (toShip > 0) {
    out.push({
      text: t('dashboard.insightToShip', {
        n: toShip,
        amount: `¥${fmtMoney(stats.value?.toShipAmount ?? 0)}`,
      }),
      to: '/orders?status=paid',
      tone: 'warning',
    });
  }

  return out.slice(0, 3);
});
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <div>
        <h2 class="h2">{{ t('dashboard.title') }}</h2>
        <p class="sub">{{ t('dashboard.subtitle') }}</p>
      </div>
      <el-radio-group v-model="range" size="default" class="range">
        <el-radio-button value="week">{{ t('dashboard.range.week') }}</el-radio-button>
        <el-radio-button value="month">{{ t('dashboard.range.month') }}</el-radio-button>
        <el-radio-button value="quarter">{{ t('dashboard.range.quarter') }}</el-radio-button>
      </el-radio-group>
    </div>

    <el-alert
      v-if="failed"
      type="error"
      :title="t('dashboard.loadFailed')"
      :description="t('dashboard.loadFailedHint')"
      show-icon
      :closable="false"
      class="mb"
    />

    <!-- HERO DECK: live clock, month revenue, sparkline, order tape -->
    <DashHero
      :stats="stats"
      :trend="charts?.trend ?? []"
      :recent="recent"
      :loading="loading"
      :range="range"
    />

    <!-- KPI -->
    <div class="kpis">
      <StatCard
        v-for="k in kpis"
        :key="k.key"
        :label="k.label"
        :value="k.value"
        :numeric="k.numeric"
        :prefix="k.prefix"
        :decimals="k.decimals"
        :suffix="k.suffix"
        :delta="k.delta ?? null"
        :delta-label="k.deltaLabel ?? ''"
        :hint="k.hint"
        :accent="k.accent ?? 'default'"
        :loading="loading"
        @select="router.push(k.to)"
      />
    </div>

    <!-- insights: content-driven rows, each deep-links to its screen -->
    <div v-if="!loading && insights.length" class="insights">
      <span class="insights-label">{{ t('dashboard.insightsTitle') }}</span>
      <button
        v-for="(ins, i) in insights"
        :key="i"
        class="insight"
        :class="`tone-${ins.tone}`"
        type="button"
        @click="router.push(ins.to)"
      >
        <span class="insight-dot" />
        <span class="insight-text">{{ ins.text }}</span>
        <span class="insight-go">→</span>
      </button>
    </div>

    <!-- charts: 3-col grid, every card spans a real slot — no half-empty rows -->
    <div class="charts">
      <div class="card chart-card span2">
        <div class="card-head">
          <span class="idx">01</span>
          <h3>{{ t('dashboard.trend') }}</h3>
          <span class="card-sub">{{ t(`dashboard.range.${range}`) }} · {{ t('dashboard.chartUnit') }}</span>
        </div>
        <div v-if="loading" class="skeleton chart-sk" />
        <TrendChart v-else :trend="charts?.trend ?? []" />
      </div>

      <div class="card chart-card">
        <div class="card-head">
          <span class="idx">02</span>
          <h3>{{ t('dashboard.statusSplit') }}</h3>
        </div>
        <div v-if="loading" class="skeleton chart-sk" />
        <StatusLedger v-else :by-status="charts?.byStatus ?? []" />
      </div>

      <div class="card chart-card">
        <div class="card-head">
          <span class="idx">03</span>
          <h3>{{ t('dashboard.topProducts') }}</h3>
          <span class="card-sub">{{ t(`dashboard.range.${range}`) }}</span>
        </div>
        <div v-if="loading" class="skeleton chart-sk" />
        <TopProductsRank v-else :top-products="charts?.topProducts ?? []" />
      </div>

      <div class="card chart-card span2 recent">
        <div class="card-head">
          <span class="idx">04</span>
          <h3>{{ t('dashboard.recentOrders') }}</h3>
          <router-link to="/orders" class="link">{{ t('common.viewAll') }} →</router-link>
        </div>

        <RecentOrders v-if="!loading" :recent="recent" />
        <el-skeleton v-else :rows="4" animated />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The page assembles top-down in one gesture — deck, readouts, insights, then
   the charts. Cheap to run, and it makes a data-heavy screen feel like it is
   booting rather than appearing. (The deck animates inside DashHero.) */
.kpis {
  animation: deck-rise 0.45s var(--ease) 0.06s both;
}

.insights {
  animation: deck-rise 0.45s var(--ease) 0.1s both;
}

.charts {
  animation: deck-rise 0.45s var(--ease) 0.14s both;
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

.toolbar {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: var(--s-5);
}

.h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.range {
  margin-left: auto;
}

.mb {
  margin-bottom: var(--s-4);
}

/* `minmax(0, 1fr)` — plain `1fr` refuses to shrink below min-content, which is
   exactly how a grid overflows the viewport and clips its right-hand column. */
.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s-4);
  margin-bottom: var(--s-4);
}

.charts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s-4);
}

.kpis > *,
.charts > * {
  min-width: 0;
}

.chart-card {
  min-width: 0;
  padding: 16px 18px;
  overflow: hidden;
}

.span2 {
  grid-column: span 2;
}

.recent {
  min-width: 0;
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}

/* Editorial index + micro-caps title: the dashboard reads like a spec sheet. */
.card-head .idx {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
}

.link {
  margin-left: auto;
  font-size: 12px;
}

.chart-sk {
  height: 264px;
  width: 100%;
}

/* --------------------------------------------------------------- insights */

/* Flat text rows, not pill buttons — insights are information, not chips. */
.insights {
  display: flex;
  align-items: stretch;
  gap: var(--s-5);
  margin-bottom: var(--s-4);
  padding: 0 var(--s-2);
}

.insights-label {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-disabled);
  padding-right: var(--s-2);
  border-right: 1px solid var(--border-light);
}

.insight {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 0;
  border-radius: var(--r-control);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}

.insight:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.insight-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
}

.insight.tone-warning .insight-dot {
  background: var(--warning);
}

.insight-text {
  flex: 1;
  min-width: 0;
  /* Insight copy is a sentence, not a label: let it take a second line rather
     than truncate mid-clause on wide screens. */
  white-space: normal;
  line-height: 1.35;
}

.insight-go {
  color: var(--text-disabled);
  font-weight: 500;
}

.insight:hover .insight-go {
  color: var(--primary);
}

@media (max-width: 1279px) {
  /* Three columns get tight below 1280 — drop to two; spans fill naturally. */
  .charts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1023px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .charts {
    grid-template-columns: minmax(0, 1fr);
  }

  .span2 {
    grid-column: auto;
  }
}

@media (max-width: 767px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .range {
    margin-left: 0;
  }

  .insights {
    flex-wrap: wrap;
    gap: var(--s-2);
    padding: 0;
  }

  .insights-label {
    width: 100%;
    border-right: 0;
    border-bottom: 1px solid var(--border-light);
    padding: 0 0 6px;
  }

  /* `flex: 1` with an auto basis keeps three insights on one squeezed row —
     the basis has to be 100% for them to stack. */
  .insight {
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
