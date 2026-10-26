<script setup lang="ts">
import { customersApi } from '@/api';
import MoneyText from '@/components/MoneyText.vue';
import StatusTag from '@/components/StatusTag.vue';
import type { CustomerDetail } from '@/types';
import { useI18n, localCompany, localName } from '@/i18n';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { ref, onMounted } from 'vue';
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
