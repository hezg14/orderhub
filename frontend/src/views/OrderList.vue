<script setup lang="ts">
import { customersApi, ordersApi, type OrderQuery } from '@/api';
import { ApiError } from '@/api/client';
import DataTable from '@/components/DataTable.vue';
import EmptyState from '@/components/EmptyState.vue';
import MoneyText from '@/components/MoneyText.vue';
import StatusTag from '@/components/StatusTag.vue';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { useAuthStore } from '@/stores/auth';
import { currentLocale, localCompany, localName, useI18n } from '@/i18n';
import type { Customer, Order, OrderStatus, PageMeta } from '@/types';
import { Delete, Filter, Plus, Refresh, Search, View } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

/** Computed so the dropdown relabels itself when the locale switches. */
const STATUS_OPTIONS = computed(() =>
  (['pending', 'paid', 'shipped', 'completed', 'cancelled'] as OrderStatus[]).map((value) => ({
    value,
    label: t(`status.${value}`),
  })),
);

const filters = reactive<{
  q: string;
  status: OrderStatus | '';
  customerId: string;
  dates: [string, string] | undefined;
  sortBy: 'createdAt' | 'total' | 'orderNo';
  sortDir: 'asc' | 'desc';
}>({
  q: (route.query.q as string) ?? '',
  status: (route.query.status as OrderStatus) ?? '',
  customerId: (route.query.customerId as string) ?? '',
  dates: undefined,
  sortBy: 'createdAt',
  sortDir: 'desc',
});

const rows = ref<Order[]>([]);
const meta = ref<PageMeta>({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
const page = ref(1);
const loading = ref(true);
const selected = ref<Order[]>([]);
const customers = ref<Customer[]>([]);
const busy = ref(false);

const hasFilters = computed(
  () => Boolean(filters.q || filters.status || filters.customerId || filters.dates),
);

/**
 * On a phone the filter bar would push the first record below the fold, so the
 * secondary controls collapse behind a toggle. Only the search box — the one
 * control people reach for without looking — stays visible.
 */
const isMobile = useMediaQuery(MOBILE_QUERY);
const filtersOpen = ref(false);
const activeFilterCount = computed(
  () => [filters.status, filters.customerId, filters.dates].filter(Boolean).length,
);

function buildQuery(): OrderQuery {
  return {
    page: page.value,
    pageSize: meta.value.pageSize,
    q: filters.q || undefined,
    status: filters.status || undefined,
    customerId: filters.customerId || undefined,
    from: filters.dates?.[0],
    to: filters.dates?.[1],
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  };
}

/** Keeps the URL shareable: paste it in another tab and you see the same view. */
function syncUrl() {
  router.replace({
    query: {
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(page.value > 1 ? { page: String(page.value) } : {}),
    },
  });
}

async function load() {
  loading.value = true;
  try {
    const res = await ordersApi.list(buildQuery());
    rows.value = res.data;
    meta.value = res.meta;
    syncUrl();
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('orders.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  load();
}

function resetFilters() {
  filters.q = '';
  filters.status = '';
  filters.customerId = '';
  filters.dates = undefined;
  page.value = 1;
  load();
}

function onSort({ prop, order }: { prop: string; order: string | null }) {
  if (!order) {
    filters.sortBy = 'createdAt';
    filters.sortDir = 'desc';
  } else {
    filters.sortBy = (prop === 'total' ? 'total' : prop === 'orderNo' ? 'orderNo' : 'createdAt') as
      | 'createdAt'
      | 'total'
      | 'orderNo';
    filters.sortDir = order === 'ascending' ? 'asc' : 'desc';
  }
  load();
}

async function remove(row: Order) {
  try {
    await ElMessageBox.confirm(t('orders.deleteBody', { orderNo: row.orderNo }), t('orderDetail.deleteTitle'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });
  } catch {
    return;
  }

  try {
    await ordersApi.remove(row.id);
    ElMessage.success(t('orders.deleted'));
    load();
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('orders.deleteFailed'));
  }
}

/**
 * Batch ship: the API has no bulk endpoint on purpose (each order must pass its
 * own state machine), so we fan out and report per-row results. Partial failure
 * is a first-class outcome, not an exception.
 */
async function batchShip() {
  const targets = selected.value.filter((o) => o.status === 'paid');
  if (targets.length === 0) {
    ElMessage.warning(t('orders.noPaidSelected'));
    return;
  }

  busy.value = true;
  const results = await Promise.allSettled(
    targets.map((o) => ordersApi.changeStatus(o.id, 'shipped')),
  );
  busy.value = false;

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - ok;

  if (failed === 0) {
    ElMessage.success(t('orders.shipped', { n: ok }));
  } else {
    ElMessage.warning(t('orders.batchFailed', { ok, fail: failed }));
  }

  selected.value = [];
  load();
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(currentLocale() === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

onMounted(async () => {
  load();
  try {
    const res = await customersApi.list({ pageSize: 100 });
    customers.value = res.data;
  } catch {
    // A missing customer list only degrades the filter, not the page.
  }
});

watch(() => route.query.status, (next) => {
  if (typeof next === 'string' && next !== filters.status) {
    filters.status = next as OrderStatus;
    applyFilters();
  }
});
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h2>{{ t('orders.title') }}</h2>
        <p class="muted">{{ t('orders.count', { n: meta.total }) }}</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="router.push('/orders/new')">
        {{ t('orders.newOrder') }}
      </el-button>
    </div>

    <!-- filters -->
    <div class="card filters">
      <el-input
        v-model="filters.q"
        :placeholder="t('orders.searchPlaceholder')"
        :prefix-icon="Search"
        clearable
        class="w-search"
        @keyup.enter="applyFilters"
        @clear="applyFilters"
      />

      <!-- `display: contents` on desktop keeps these as direct flex children;
           on a phone the wrapper becomes a collapsible stack. -->
      <div class="filter-rest" :class="{ 'is-open': filtersOpen }">
        <el-select v-model="filters.status" :placeholder="t('orders.allStatus')" clearable class="w-140" @change="applyFilters">
          <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>

        <el-select
          v-model="filters.customerId"
          :placeholder="t('orders.allCustomers')"
          clearable
          filterable
          class="w-180"
          @change="applyFilters"
        >
          <el-option v-for="c in customers" :key="c.id" :label="localName(c)" :value="c.id" />
        </el-select>

        <el-date-picker
          v-model="filters.dates"
          type="daterange"
          value-format="YYYY-MM-DD"
          :start-placeholder="t('orders.start')"
          :end-placeholder="t('orders.end')"
          class="w-260"
          @change="applyFilters"
        />

        <el-button :icon="Refresh" :disabled="!hasFilters" @click="resetFilters">
          {{ t('common.reset') }}
        </el-button>
      </div>

      <el-button
        v-if="isMobile"
        class="filter-toggle"
        :icon="Filter"
        :type="activeFilterCount ? 'primary' : 'default'"
        plain
        :aria-expanded="filtersOpen"
        @click="filtersOpen = !filtersOpen"
      >
        {{ activeFilterCount ? t('orders.filtersActive', { n: activeFilterCount }) : t('orders.filters') }}
      </el-button>
    </div>

    <!-- batch bar -->
    <transition name="slide">
      <div v-if="selected.length" class="batch">
        <span>{{ t('orders.selected', { n: selected.length }) }}</span>
        <el-button size="small" :loading="busy" @click="batchShip">
          {{ t('orders.batchShip') }}
        </el-button>
        <el-button size="small" text @click="selected = []">{{ t('orders.cancelSelection') }}</el-button>
        <span class="batch-hint">{{ t('orders.selectHint') }}</span>
      </div>
    </transition>

    <!-- table -->
    <DataTable
      v-model:page="page"
      :rows="rows"
      :meta="meta"
      :loading="loading"
      :info="t('orders.pagerInfo', { total: meta.total, pageSize: meta.pageSize })"
      row-key="id"
      @selection-change="(v: Order[]) => (selected = v)"
      @sort-change="onSort"
      @change="load"
    >
        <el-table-column type="selection" width="44" :selectable="(row: Order) => row.status !== 'cancelled'" />

        <el-table-column prop="orderNo" :label="t('orders.orderNo')" width="150" sortable="custom">
          <template #default="{ row }">
            <router-link :to="`/orders/${row.id}`" class="mono order-no">{{ row.orderNo }}</router-link>
          </template>
        </el-table-column>

        <el-table-column :label="t('orders.customer')" min-width="160">
          <template #default="{ row }">
            <router-link :to="`/customers/${row.customerId}`" class="customer-link">
              {{ row.customer ? localName(row.customer) : '—' }}
            </router-link>
            <div v-if="row.customer" class="company">{{ localCompany(row.customer) }}</div>
          </template>
        </el-table-column>

        <el-table-column :label="t('orders.amount')" width="130" align="right" prop="total" sortable="custom">
          <template #default="{ row }"><MoneyText :value="row.total" /></template>
        </el-table-column>

        <el-table-column :label="t('orders.status')" width="140">
          <template #default="{ row }"><StatusTag :status="row.status" /></template>
        </el-table-column>

        <el-table-column :label="t('orders.created')" width="190" prop="createdAt" sortable="custom">
          <template #default="{ row }"><span class="muted tabular">{{ fmtDate(row.createdAt) }}</span></template>
        </el-table-column>

        <el-table-column :label="t('common.actions')" width="96" align="right" fixed="right">
          <template #default="{ row }">
            <el-tooltip :content="t('orders.view')" placement="top">
              <el-button
                link
                type="primary"
                size="small"
                :icon="View"
                :aria-label="t('orders.view')"
                @click="router.push(`/orders/${row.id}`)"
              />
            </el-tooltip>
            <el-tooltip
              v-if="!auth.isAdmin || row.status !== 'pending'"
              :content="!auth.isAdmin ? t('orders.deleteAdminOnly') : t('orders.deletePendingOnly')"
              placement="top"
            >
              <span class="disabled-wrap">
                <el-button link size="small" disabled :icon="Delete" />
              </span>
            </el-tooltip>
            <el-tooltip v-else :content="t('common.delete')" placement="top">
              <el-button link type="danger" size="small" :icon="Delete" :aria-label="t('common.delete')" @click="remove(row)" />
            </el-tooltip>
          </template>
        </el-table-column>

        <!-- Phone layout: the same record as a card. A table can only show its
             left edge at 390px, which hides the two fields that matter most
             (amount and status). -->
        <template #mobile="{ row }">
          <div class="rec">
            <div class="rec-row">
              <router-link :to="`/orders/${row.id}`" class="mono order-no">{{ row.orderNo }}</router-link>
              <MoneyText :value="row.total" class="rec-amount" />
            </div>
            <div class="rec-row">
              <router-link v-if="row.customer" :to="`/customers/${row.customerId}`" class="customer-link">
                {{ localName(row.customer) }}
              </router-link>
              <span v-else class="muted">—</span>
              <StatusTag :status="row.status" />
            </div>
            <div class="rec-row rec-foot">
              <span class="muted tabular rec-date">{{ fmtDate(row.createdAt) }}</span>
              <div class="rec-actions">
                <el-button
                  link
                  type="primary"
                  size="small"
                  :icon="View"
                  :aria-label="t('orders.view')"
                  @click="router.push(`/orders/${row.id}`)"
                />
                <el-button
                  v-if="auth.isAdmin && row.status === 'pending'"
                  link
                  type="danger"
                  size="small"
                  :icon="Delete"
                  :aria-label="t('common.delete')"
                  @click="remove(row)"
                />
              </div>
            </div>
          </div>
        </template>

        <template #empty>
          <EmptyState
            :title="hasFilters ? t('orders.empty') : t('orders.emptyNoFilter')"
            :description="hasFilters ? t('orders.emptyFilteredHint') : t('orders.emptyHint')"
          >
            <el-button v-if="hasFilters" @click="resetFilters">{{ t('orders.clearFilters') }}</el-button>
            <el-button v-else type="primary" @click="router.push('/orders/new')">
              {{ t('orders.newOrder') }}
            </el-button>
          </EmptyState>
        </template>
    </DataTable>
  </div>
</template>

<style scoped>
/* .head styles come from tokens.css — the shared page-header pattern. */

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: var(--s-3);
  align-items: center;
}

.w-search {
  width: 260px;
}

.w-140 {
  width: 140px;
}

.w-180 {
  width: 180px;
}

.w-260 {
  width: 260px;
}

.batch {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 16px;
  margin-bottom: var(--s-3);
  background: var(--primary-bg);
  border: 1px solid var(--primary-border);
  border-radius: var(--r-control);
  font-size: 13px;
  color: var(--primary);
}

.batch-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary);
}

.order-no {
  font-size: 13px;
  font-weight: 500;
}

.customer-link {
  color: var(--text-primary);
  font-weight: 500;
}

.customer-link:hover {
  color: var(--primary);
}

.company {
  font-size: 11px;
  color: var(--text-disabled);
}

.disabled-wrap {
  display: inline-block;
  margin-left: 8px;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity var(--t-fast) var(--ease), transform var(--t-fast) var(--ease);
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Desktop: the wrapper vanishes so its children join the filter row directly. */
.filter-rest {
  display: contents;
}

/* Phone record. Amount and status are the two fields the table hides behind a
   horizontal scroll, so they get the top positions here. */
.rec {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
}

.rec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.rec-amount {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.rec-date {
  font-size: 11px;
}

.rec-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

@media (max-width: 767px) {
  .w-search,
  .w-180,
  .w-260 {
    width: 100%;
  }

  .filters > * {
    flex: 1 1 100%;
  }

  .filter-rest {
    display: none;
  }

  .filter-rest.is-open {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .filter-rest > * {
    width: 100%;
  }
}
</style>
