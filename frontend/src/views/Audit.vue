<script setup lang="ts">
import { auditApi } from '@/api';
import DataTable from '@/components/DataTable.vue';
import EmptyState from '@/components/EmptyState.vue';
import type { AuditLog, PageMeta } from '@/types';
import { localName, useI18n } from '@/i18n';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { Filter, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';

const { t, localeCode } = useI18n();

const rows = ref<AuditLog[]>([]);
const meta = ref<PageMeta>({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
const actors = ref<{ id: string; name: string }[]>([]);
const page = ref(1);
const loading = ref(true);

const filters = reactive({
  action: '',
  userId: '',
  entity: '',
  // Element Plus date-picker types modelValue as [string, string] | undefined —
  // null is rejected by vue-tsc.
  dates: undefined as [string, string] | undefined,
});

const ENTITY_LABEL = computed<Record<string, string>>(() => ({
  order: t('audit.entity.order'),
  customer: t('audit.entity.customer'),
  product: t('audit.entity.product'),
  user: t('audit.entity.user'),
}));

const ACTION_LABEL = computed<Record<string, string>>(() => ({
  create: t('audit.action.create'),
  update: t('audit.action.update'),
  delete: t('audit.action.delete'),
}));

const hasFilters = computed(
  () => Boolean(filters.action || filters.userId || filters.entity || filters.dates),
);

/**
 * "Read-only, records cannot be edited" plus a page of fields is a lot of
 * chrome above the first entry on a phone. The controls collapse behind a
 * toggle there; desktop keeps the full bar visible.
 */
const isMobile = useMediaQuery(MOBILE_QUERY);
const filtersOpen = ref(false);
const activeFilterCount = computed(
  () => [filters.action, filters.userId, filters.entity, filters.dates].filter(Boolean).length,
);

async function load() {
  loading.value = true;
  try {
    const res = await auditApi.list({
      page: page.value,
      pageSize: meta.value.pageSize,
      action: filters.action || undefined,
      userId: filters.userId || undefined,
      entity: filters.entity || undefined,
      from: filters.dates?.[0],
      to: filters.dates?.[1],
    });
    rows.value = res.data;
    meta.value = res.meta;
    actors.value = res.meta.actors ?? actors.value;
  } catch {
    ElMessage.error(t('audit.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function reset() {
  filters.action = '';
  filters.userId = '';
  filters.entity = '';
  filters.dates = undefined;
  page.value = 1;
  load();
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(localeCode.value, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

/** Turns the JSONB detail into one readable line without dumping raw JSON. */
const STATUS_KEYS = new Set(['pending', 'paid', 'shipped', 'completed', 'cancelled']);

/** Stored column names are not UI language: translate what we have, else raw. */
const FIELD_LABEL: Record<string, string> = {
  customerId: 'orders.customer',
  productId: 'orderDetail.product',
  quantity: 'orderDetail.quantity',
  unitPrice: 'orderDetail.unitPrice',
  price: 'orderDetail.unitPrice',
  stock: 'products.stock',
  sku: 'products.sku',
  name: 'settings.name',
  company: 'orderDetail.company',
  phone: 'orderDetail.phone',
  email: 'orderDetail.email',
  address: 'orderDetail.address',
  note: 'orderDetail.note',
  status: 'orders.status',
};

const statusLabel = (v: unknown) =>
  STATUS_KEYS.has(String(v)) ? t(`status.${String(v)}`) : String(v);

const fieldLabel = (k: string) => (FIELD_LABEL[k] ? t(FIELD_LABEL[k]!) : k);

function summary(log: AuditLog): string {
  const d = log.detail as Record<string, unknown>;
  if (d.field === 'status' && d.from && d.to) {
    return t('audit.statusChange', { from: statusLabel(d.from), to: statusLabel(d.to) });
  }
  if (d.changes && typeof d.changes === 'object') {
    const fields = Object.keys(d.changes as object).map(fieldLabel).join(', ');
    return t('audit.fieldsChanged', { fields });
  }
  if (d.stock && typeof d.stock === 'object') {
    const s = d.stock as { from: number; to: number };
    return t('audit.stockChange', { from: s.from, to: s.to });
  }
  if (d.orderNo) return String(d.orderNo);
  if (d.name) return String(d.name);
  if (d.email) return String(d.email);
  const keys = Object.keys(d);
  return keys.length ? keys.join(', ') : '—';
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h2>{{ t('audit.title') }}</h2>
        <p class="muted">{{ t('audit.subtitle', { total: meta.total }) }}</p>
      </div>
    </div>

    <div class="card bar">
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

      <div class="filter-rest" :class="{ 'is-open': filtersOpen }">
        <el-select v-model="filters.action" :placeholder="t('audit.allActions')" clearable class="w-120" @change="page = 1; load()">
          <el-option :label="t('audit.action.create')" value="create" />
          <el-option :label="t('audit.action.update')" value="update" />
          <el-option :label="t('audit.action.delete')" value="delete" />
        </el-select>

        <el-select v-model="filters.userId" :placeholder="t('audit.allUsers')" clearable filterable class="w-160" @change="page = 1; load()">
          <el-option v-for="a in actors" :key="a.id" :label="localName(a)" :value="a.id" />
        </el-select>

        <el-select v-model="filters.entity" :placeholder="t('audit.allEntities')" clearable class="w-130" @change="page = 1; load()">
          <el-option :label="t('audit.entity.order')" value="order" />
          <el-option :label="t('audit.entity.customer')" value="customer" />
          <el-option :label="t('audit.entity.product')" value="product" />
          <el-option :label="t('audit.entity.user')" value="user" />
        </el-select>

        <el-date-picker
          v-model="filters.dates"
          type="daterange"
          value-format="YYYY-MM-DD"
          :start-placeholder="t('orders.start')"
          :end-placeholder="t('orders.end')"
          class="w-240"
          @change="page = 1; load()"
        />

        <el-button :icon="Refresh" :disabled="!hasFilters" @click="reset">{{ t('common.reset') }}</el-button>
      </div>
    </div>

    <DataTable
      v-model:page="page"
      v-model:page-size="meta.pageSize"
      :rows="rows"
      :meta="meta"
      :loading="loading"
      :info="t('audit.pagerTotal', { total: meta.total })"
      row-key="id"
      @change="load"
    >
        <el-table-column type="expand">
          <template #default="{ row }">
            <pre class="json">{{ JSON.stringify(row.detail, null, 2) }}</pre>
            <p v-if="row.requestId" class="req mono">{{ t('audit.requestId') }}: {{ row.requestId }}</p>
          </template>
        </el-table-column>

        <el-table-column :label="t('audit.time')" width="196">
          <template #default="{ row }"><span class="mono small nowrap">{{ fmt(row.createdAt) }}</span></template>
        </el-table-column>

        <el-table-column :label="t('audit.actor')" width="156">
          <template #default="{ row }">
            <span class="who nowrap">{{ row.user ? localName(row.user) : t('common.system') }}</span>
            <span v-if="row.user?.role" class="role">{{ row.user.role === 'admin' ? t('nav.admin') : t('nav.staff') }}</span>
          </template>
        </el-table-column>

        <el-table-column :label="t('common.actions')" width="90">
          <template #default="{ row }">
            <span class="act" :class="`act-${row.action}`">
              {{ ACTION_LABEL[row.action] ?? row.action }}
            </span>
          </template>
        </el-table-column>

        <el-table-column :label="t('audit.object')" width="150">
          <template #default="{ row }">
            <span class="entity">{{ ENTITY_LABEL[row.entity] ?? row.entity }}</span>
            <span class="eid mono">{{ row.entityId.slice(0, 8) }}</span>
          </template>
        </el-table-column>

        <el-table-column :label="t('audit.detail')" min-width="220">
          <template #default="{ row }"><span class="detail">{{ summary(row) }}</span></template>
        </el-table-column>

        <template #mobile="{ row }">
          <div class="rec">
            <div class="rec-row">
              <span class="mono small nowrap">{{ fmt(row.createdAt) }}</span>
              <span class="act" :class="`act-${row.action}`">{{ ACTION_LABEL[row.action] ?? row.action }}</span>
            </div>

            <div class="rec-row">
              <span class="who">
                {{ row.user ? localName(row.user) : t('common.system') }}
                <span v-if="row.user?.role" class="role-inline">
                  · {{ row.user.role === 'admin' ? t('nav.admin') : t('nav.staff') }}
                </span>
              </span>
              <span class="entity">{{ ENTITY_LABEL[row.entity] ?? row.entity }}</span>
            </div>

            <div class="detail">{{ summary(row) }}</div>

            <!-- Native <details> keeps expand state local: no per-row refs. -->
            <details class="rec-json">
              <summary>{{ t('audit.detail') }}</summary>
              <pre class="json">{{ JSON.stringify(row.detail, null, 2) }}</pre>
              <p v-if="row.requestId" class="req mono">{{ t('audit.requestId') }}: {{ row.requestId }}</p>
            </details>
          </div>
        </template>

        <template #empty>
          <EmptyState
            :title="hasFilters ? t('audit.filteredEmpty') : t('audit.empty')"
            :description="t('audit.emptyHint')"
          >
            <el-button v-if="hasFilters" @click="reset">{{ t('audit.clearFilters') }}</el-button>
          </EmptyState>
        </template>
    </DataTable>
  </div>
</template>

<style scoped>
/* .head styles come from tokens.css — the shared page-header pattern. */

.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 14px 16px;
  margin-bottom: var(--s-3);
}

.w-120 { width: 120px; }
.w-130 { width: 130px; }
.w-160 { width: 160px; }
.w-240 { width: 240px; }

.small { font-size: 12px; }

.who { font-weight: 500; }

.role {
  display: block;
  font-size: 10px;
  color: var(--text-disabled);
}

.act {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 500;
}

/* Semantic tint from tokens — follows the theme instead of hard-coded hex. */
.act-create {
  color: var(--success);
  background: var(--success-bg);
}

.act-update {
  color: var(--primary);
  background: var(--primary-bg);
}

.act-delete {
  color: var(--danger);
  background: var(--danger-bg);
}

.entity { font-weight: 500; }

.eid {
  display: block;
  font-size: 10px;
  color: var(--text-disabled);
}

.detail {
  font-size: 12px;
  color: var(--text-secondary);
}

.json {
  margin: 0;
  padding: 12px 20px;
  background: var(--bg-subtle);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-x: auto;
}

.req {
  margin: 0;
  padding: 6px 20px 12px;
  font-size: 10px;
  color: var(--text-disabled);
  background: var(--bg-subtle);
}

/* Desktop: children join the bar's own flex row. */
.filter-rest {
  display: contents;
}

.filter-toggle {
  width: 100%;
}

/* Phone record: an audit entry reads as a short sentence, not a row of cells. */
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

.role-inline {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-disabled);
}

/* Tie the change summary to its record: without the rule it reads as the next
   entry's heading. */
.rec .detail {
  padding-left: 8px;
  border-left: 2px solid var(--border);
  font-size: 12px;
}

.rec-json {
  margin-top: 2px;
}

.rec-json > summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  list-style: none;
}

.rec-json > summary::-webkit-details-marker {
  display: none;
}

/* A drawn triangle beats a glyph here: '▸' renders as a dot in some UI fonts. */
.rec-json > summary::before {
  content: '';
  width: 0;
  height: 0;
  border-left: 4px solid currentColor;
  border-top: 3.5px solid transparent;
  border-bottom: 3.5px solid transparent;
  transition: transform var(--t-fast) var(--ease);
}

.rec-json[open] > summary::before {
  transform: rotate(90deg);
}

.rec-json .json {
  margin: 6px 0 0;
  max-height: 220px;
  overflow: auto;
}

@media (max-width: 767px) {
  .w-120, .w-130, .w-160, .w-240 {
    width: 100%;
  }

  .bar > * {
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
