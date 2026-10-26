<script setup lang="ts">
import { customersApi } from '@/api';
import MoneyText from '@/components/MoneyText.vue';
import StatusTag from '@/components/StatusTag.vue';
import type { CustomerDetail } from '@/types';
import { useI18n, localCompany, localName } from '@/i18n';
import { fmtMoney } from '@/utils/format';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const { t, localeCode } = useI18n();
const isMobile = useMediaQuery(MOBILE_QUERY);
const route = useRoute();
const router = useRouter();
const data = ref<CustomerDetail | null>(null);
const loading = ref(true);
const missing = ref(false);

async function load() {
  loading.value = true;
  try {
    data.value = await customersApi.get(route.params.id as string);
    deriveCredit(data.value);
  } catch {
    missing.value = true;
    ElMessage.error(t('customerDetail.loadFailed'));
  } finally {
    loading.value = false;
  }
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(localeCode.value, { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

function newOrder() {
  if (!data.value) return;
  // Pre-select the customer on the create page.
  router.push({ path: '/orders/new', query: { customerId: data.value.id } });
}

onMounted(load);

/* Credit usage: null limit = cash customer, the whole card disappears. */
const credit = ref<{ receivable: number; limit: number; usage: number } | null>(null);
const creditTone = computed(() => {
  if (!credit.value) return 'ok';
  if (credit.value.usage >= 1) return 'over';
  if (credit.value.usage >= 0.75) return 'warn';
  return 'ok';
});
function deriveCredit(d: CustomerDetail) {
  if (d.creditLimit == null) {
    credit.value = null;
    return;
  }
  credit.value = {
    receivable: d.stats.receivable,
    limit: d.creditLimit,
    usage: d.creditLimit === 0 ? 1 : d.stats.receivable / d.creditLimit,
  };
}
</script>

<template>
  <div class="page">
    <el-skeleton v-if="loading" :rows="8" animated />

    <el-result v-else-if="missing" icon="warning" :title="t('customerDetail.notFound')" :sub-title="t('customerDetail.notFoundHint')">
      <template #extra><el-button type="primary" @click="router.push('/customers')">{{ t('customerDetail.back') }}</el-button></template>
    </el-result>

    <template v-else-if="data">
      <router-link to="/customers" class="back">‹ {{ t('customerDetail.back') }}</router-link>

      <div class="card profile">
        <div class="avatar">{{ localName(data).slice(0, 1) }}</div>
        <div class="meta">
          <h2>{{ localName(data) }}</h2>
          <p class="muted">{{ localCompany(data) || t('customerDetail.noCompany') }}</p>
          <div class="contacts">
            <span v-if="data.phone">{{ t('customerDetail.phone') }} {{ data.phone }}</span>
            <span v-if="data.email">{{ data.email }}</span>
            <span v-if="data.address">{{ data.address }}</span>
          </div>
        </div>
        <el-button type="primary" :icon="Plus" @click="newOrder">{{ t('customerDetail.newOrder') }}</el-button>
      </div>

      <div class="stats">
        <div class="card stat">
          <span class="k">{{ t('customerDetail.orders') }}</span>
          <b class="v tabular">{{ data.stats.orders }}</b>
        </div>
        <div class="card stat">
          <span class="k">{{ t('customerDetail.revenue') }}</span>
          <b class="v tabular"><MoneyText :value="data.stats.revenue" /></b>
        </div>
        <div class="card stat">
          <span class="k">{{ t('customerDetail.avgOrder') }}</span>
          <b class="v tabular"><MoneyText :value="data.stats.avgOrder" /></b>
        </div>
        <div class="card stat">
          <span class="k">{{ t('customerDetail.lastOrder') }}</span>
          <b class="v date">{{ fmt(data.stats.lastOrderAt) }}</b>
        </div>
      </div>

      <!-- Open credit: receivable vs ceiling. Hidden for cash customers. -->
      <div v-if="credit" class="card credit" :class="`is-${creditTone}`">
        <div class="card-head">
          <h3>{{ t('customerDetail.credit.title') }}</h3>
          <span v-if="creditTone === 'over'" class="credit-flag">{{ t('customerDetail.credit.over') }}</span>
          <span v-else-if="creditTone === 'warn'" class="credit-flag">{{ t('customerDetail.credit.warn') }}</span>
        </div>
        <div class="credit-row">
          <div class="credit-bar" role="img" :aria-label="t('customerDetail.credit.aria', { usage: Math.round(credit.usage * 100) })">
            <i :style="{ width: `${Math.min(100, credit.usage * 100)}%` }" />
          </div>
          <span class="credit-nums mono tabular">
            {{ t('customerDetail.credit.usage', {
              receivable: fmtMoney(credit.receivable),
              limit: fmtMoney(credit.limit),
              pct: Math.round(credit.usage * 100),
            }) }}
          </span>
        </div>
        <p class="muted credit-hint">{{ t('customerDetail.credit.hint', { pending: data.stats.pendingOrders }) }}</p>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>{{ t('customerDetail.history') }}</h3>
          <span class="muted">{{ t('customerDetail.recentHint') }}</span>
        </div>

        <el-table v-if="!isMobile" :data="data.recentOrders" style="width: 100%">
          <el-table-column :label="t('orders.orderNo')" width="150">
            <template #default="{ row }">
              <router-link :to="`/orders/${row.id}`" class="mono link">{{ row.orderNo }}</router-link>
            </template>
          </el-table-column>
          <el-table-column :label="t('orders.amount')" width="130" align="right">
            <template #default="{ row }"><MoneyText :value="row.total" /></template>
          </el-table-column>
          <el-table-column :label="t('orders.status')" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
          <el-table-column :label="t('orders.created')" width="130">
            <template #default="{ row }"><span class="muted tabular">{{ fmt(row.createdAt) }}</span></template>
          </el-table-column>
          <el-table-column :label="t('orders.note')" min-width="180">
            <template #default="{ row }"><span class="muted">{{ row.note || '—' }}</span></template>
          </el-table-column>

          <template #empty>
            <p class="empty">{{ t('customerDetail.noOrders') }}</p>
          </template>
        </el-table>

        <ul v-else-if="data.recentOrders.length" class="hist-list">
          <li v-for="row in data.recentOrders" :key="row.id" class="hist-rec">
            <div class="hist-row">
              <router-link :to="`/orders/${row.id}`" class="mono link">{{ row.orderNo }}</router-link>
              <MoneyText :value="row.total" class="hist-amount" />
            </div>
            <div class="hist-row">
              <StatusTag :status="row.status" />
              <span class="muted tabular hist-date">{{ fmt(row.createdAt) }}</span>
            </div>
          </li>
        </ul>
        <p v-else class="empty">{{ t('customerDetail.noOrders') }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Credit usage bar — the rail mirrors the StatusFlow fill language. */
.credit {
  margin-bottom: var(--s-4);
}

.credit-flag {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid currentcolor;
}

.is-over .credit-flag {
  color: var(--danger, #dc2626);
}

.is-warn .credit-flag {
  color: var(--warning, #d97706);
}

.credit-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.credit-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--bg-inset);
  border: 1px solid var(--border-light);
  overflow: hidden;
}

.credit-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
  transition: width 0.5s var(--ease);
}

.is-warn .credit-bar i {
  background: var(--warning, #d97706);
}

.is-over .credit-bar i {
  background: var(--danger, #dc2626);
}

.credit-nums {
  flex: none;
  font-size: 12px;
  color: var(--text-secondary);
}

.credit-hint {
  margin: 10px 0 0;
  font-size: 12px;
}

.back {
  display: inline-block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.profile {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 24px;
  margin-bottom: var(--s-5);
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--primary-bg);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 700;
  flex: none;
}

.meta {
  flex: 1;
  min-width: 0;
}

.meta h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.01em;
}

.meta p {
  margin: 3px 0 0;
  font-size: 13px;
}

.contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--s-4);
  margin-bottom: var(--s-5);
}

.stat {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.k {
  font-size: 12px;
  color: var(--text-secondary);
}

.v {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.date {
  font-size: 18px;
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 16px 20px 8px;
}


.card-head .muted {
  font-size: 12px;
}

.link {
  font-size: 13px;
}

.empty {
  padding: 24px;
  text-align: center;
  color: var(--text-disabled);
  font-size: 13px;
}

/* Phone order history: same record shape as the orders list. */
.hist-list {
  list-style: none;
  margin: 0;
  padding: 0 16px;
}

.hist-rec {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
  border-top: 1px solid var(--border-light);
}

.hist-rec:first-child {
  border-top: none;
}

.hist-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hist-amount {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.hist-date {
  font-size: 11px;
}

@media (max-width: 1023px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 767px) {
  .profile {
    flex-wrap: wrap;
  }

  /* Four stacked stat cards pushed the history two screens down. */
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s-3);
  }

  .stat {
    padding: 12px 14px;
  }
}
</style>
