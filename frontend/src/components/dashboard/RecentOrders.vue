<script setup lang="ts">
import MoneyText from '@/components/MoneyText.vue';
import StatusTag from '@/components/StatusTag.vue';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { currentLocale, localName, useI18n } from '@/i18n';
import type { Order } from '@/types';
import { computed } from 'vue';

/** Card 04: recent orders — table on desktop, list rows on phones. */
const props = defineProps<{
  recent: Order[];
}>();

const { t } = useI18n();
const isMobile = useMediaQuery(MOBILE_QUERY);

const locale = computed(() => (currentLocale() === 'zh' ? 'zh-CN' : 'en-US'));

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(locale.value, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
</script>

<template>
  <el-table v-if="!isMobile" :data="recent" :show-header="true" size="default" style="width: 100%">
    <el-table-column prop="orderNo" :label="t('orders.orderNo')" width="140">
      <template #default="{ row }">
        <router-link :to="`/orders/${row.id}`" class="mono order-link">{{ row.orderNo }}</router-link>
      </template>
    </el-table-column>
    <el-table-column :label="t('orders.customer')" min-width="140">
      <template #default="{ row }">{{ row.customer ? localName(row.customer) : '—' }}</template>
    </el-table-column>
    <el-table-column :label="t('orders.amount')" width="120" align="right">
      <template #default="{ row }"><MoneyText :value="row.total" /></template>
    </el-table-column>
    <el-table-column :label="t('orders.status')" width="130">
      <template #default="{ row }"><StatusTag :status="row.status" /></template>
    </el-table-column>
    <el-table-column :label="t('orders.created')" width="150">
      <template #default="{ row }">
        <span class="muted">{{ fmtTime(row.createdAt) }}</span>
      </template>
    </el-table-column>
  </el-table>

  <ul v-else class="recent-list">
    <li v-for="row in props.recent" :key="row.id" class="recent-row">
      <div class="recent-line">
        <router-link :to="`/orders/${row.id}`" class="mono order-link">{{ row.orderNo }}</router-link>
        <MoneyText :value="row.total" />
      </div>
      <div class="recent-line">
        <span class="muted recent-cust">{{ row.customer ? localName(row.customer) : '—' }}</span>
        <StatusTag :status="row.status" />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.order-link {
  font-size: 13px;
}

/* Phone replacement for the five-column recent-orders table. */
.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.recent-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 0;
  border-top: 1px solid var(--border-light);
}

.recent-row:first-child {
  border-top: none;
}

.recent-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.recent-cust {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-line :deep(.money) {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
