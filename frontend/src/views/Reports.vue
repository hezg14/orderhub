<script setup lang="ts">
import { reportsApi, type ReportType } from '@/api';
import { ApiError } from '@/api/client';
import type { ReportPreview } from '@/types';
import { useI18n } from '@/i18n';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { Download, Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';

const { t } = useI18n();

/**
 * Preview columns come from the API, so the phone layout cannot hard-code them:
 * the first column becomes the record's heading and every remaining column is
 * rendered as a label/value pair underneath.
 */
const isMobile = useMediaQuery(MOBILE_QUERY);

const type = ref<ReportType>('orders');
// Element Plus date-picker modelValue type is `| undefined`, not `| null`.
const dates = ref<[string, string]>();
const preview = ref<ReportPreview | null>(null);
const loading = ref(false);
const exporting = ref(false);

const firstColumn = computed(() => preview.value?.columns[0]);
const restColumns = computed(() => preview.value?.columns.slice(1) ?? []);

const TYPES = computed<{ value: ReportType; label: string; desc: string }[]>(() => [
  { value: 'orders', label: t('reports.types.orders'), desc: t('reports.types.ordersDesc') },
  { value: 'customers', label: t('reports.types.customers'), desc: t('reports.types.customersDesc') },
  { value: 'products', label: t('reports.types.products'), desc: t('reports.types.productsDesc') },
]);

const rangeLabel = computed(() => {
  if (!dates.value) return t('reports.defaultRange');
  return t('reports.rangeValue', { from: dates.value[0], to: dates.value[1] });
});

function params() {
  return {
    type: type.value,
    from: dates.value?.[0],
    to: dates.value?.[1],
  };
}

async function runPreview() {
  loading.value = true;
  try {
    preview.value = await reportsApi.preview(params());
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('reports.previewFailed'));
  } finally {
    loading.value = false;
  }
}

async function exportCsv() {
  exporting.value = true;
  try {
    const rows = await reportsApi.exportCsv(params());
    ElMessage.success(t('reports.exported', { rows }));
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('reports.exportFailed'));
  } finally {
    exporting.value = false;
  }
}

/** Numeric columns get right alignment + tabular figures. */
function isNumeric(value: string | number) {
  return typeof value === 'number';
}

onMounted(runPreview);
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h2>{{ t('reports.title') }}</h2>
        <p class="muted">{{ t('reports.subtitle') }}</p>
      </div>
    </div>

    <div class="types">
      <button
        v-for="tp in TYPES"
        :key="tp.value"
        type="button"
        class="type-card"
        :class="{ on: type === tp.value }"
        @click="type = tp.value; runPreview()"
      >
        <div class="type-head">
          <span class="radio" />
          <b>{{ tp.label }}</b>
        </div>
        <p>{{ tp.desc }}</p>
      </button>
    </div>

    <div class="card bar">
      <el-date-picker
        v-model="dates"
        type="daterange"
        value-format="YYYY-MM-DD"
        :start-placeholder="t('reports.startDate')"
        :end-placeholder="t('reports.endDate')"
        class="w-260"
        @change="runPreview"
      />
      <span class="muted range">{{ t('reports.range') }}：{{ rangeLabel }}</span>
      <div class="right">
        <el-button :icon="Search" :loading="loading" @click="runPreview">{{ t('reports.refreshPreview') }}</el-button>
        <el-button type="primary" :icon="Download" :loading="exporting" @click="exportCsv">
          {{ t('common.exportCsv') }}
        </el-button>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>{{ preview?.title ?? t('reports.preview') }}</h3>
        <span v-if="preview" class="muted">
          {{ t('reports.rowCount', { total: preview.total, shown: preview.rows.length }) }}
        </span>
      </div>

      <el-table v-if="!isMobile" v-loading="loading" :data="preview?.rows ?? []" style="width: 100%">
        <el-table-column
          v-for="col in preview?.columns ?? []"
          :key="col.key"
          :prop="col.key"
          :label="col.label"
          :align="col.align ?? 'left'"
          min-width="120"
        >
          <template #default="{ row }">
            <span :class="{ tabular: isNumeric(row[col.key]) }">{{ row[col.key] }}</span>
          </template>
        </el-table-column>

        <template #empty>
          <p class="empty">{{ t('reports.empty') }}</p>
        </template>
      </el-table>

      <ul v-else-if="preview?.rows.length" class="preview-list">
        <li v-for="(row, ri) in preview.rows" :key="ri" class="preview-rec">
          <div v-if="firstColumn" class="pr-head mono">{{ row[firstColumn.key] }}</div>
          <div v-for="col in restColumns" :key="col.key" class="pr-pair">
            <span class="pr-label">{{ col.label }}</span>
            <span :class="{ tabular: isNumeric(row[col.key]) }">{{ row[col.key] }}</span>
          </div>
        </li>
      </ul>

      <p v-else class="empty">{{ t('reports.empty') }}</p>

      <div v-if="preview && preview.total > preview.rows.length" class="foot">
        <span class="muted">
          {{ t('reports.exportNote', { total: preview.total, shown: preview.rows.length }) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* .head styles come from tokens.css — the shared page-header pattern. */

.types {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-4);
  margin-bottom: var(--s-4);
}

.type-card {
  text-align: left;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  background: var(--bg-card);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}

.type-card:hover {
  border-color: var(--primary-border);
}

.type-card.on {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgb(37 99 235 / 8%);
}

.type-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  flex: none;
}

.type-card.on .radio {
  border: 4px solid var(--primary);
}

.type-card p {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: var(--s-3);
}

.w-260 {
  width: 260px;
}

.range {
  font-size: 12px;
}

.right {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 16px 20px 8px;
}


.card-head .muted {
  font-size: 12px;
}

.empty {
  padding: 32px;
  text-align: center;
  color: var(--text-disabled);
  font-size: 13px;
}

.foot {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border-light);
  font-size: 12px;
}

/* Phone preview: heading + label/value pairs, driven by whatever columns the
   API returned. Nothing is hidden and nothing scrolls sideways. */
.preview-list {
  list-style: none;
  margin: 0;
  padding: 0 16px;
}

.preview-rec {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--border-light);
}

.preview-rec:first-child {
  border-top: none;
}

.pr-head {
  grid-column: 1 / -1;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
}

/* Two-up grid: an order row has 7–8 fields, and stacking each one on its own
   line pushes a single record past the fold. */
.pr-pair {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  padding: 3px 0;
  font-size: 13px;
}

.pr-pair > span:last-child {
  overflow-wrap: anywhere;
}

.pr-label {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-disabled);
}

@media (max-width: 1023px) {
  .types {
    grid-template-columns: 1fr;
  }

  .bar {
    flex-wrap: wrap;
  }

  .right {
    margin-left: 0;
    width: 100%;
  }
}
</style>
