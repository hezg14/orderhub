<script setup lang="ts" generic="T extends object">
import EmptyState from '@/components/EmptyState.vue';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import type { PageMeta } from '@/types';

/**
 * The standard list surface: card frame + table + pagination.
 *
 * Views own their columns (default slot) and their empty state (#empty slot);
 * this component owns the frame, the loading state and paging behaviour so
 * every list in the product looks and behaves identically.
 *
 * Below 768px a data table is the wrong instrument: columns get clipped and the
 * reader can only see the left edge of each row. Views therefore supply a
 * `#mobile` slot that renders the same rows as stacked records, and the table
 * is swapped out entirely on phones. The view decides what a record looks like;
 * this component only handles repetition, keys and the empty state.
 *
 * Any extra attribute (row-key, sort events, selection handlers…) falls
 * through to <el-table>, so no prop has to be re-declared here.
 */
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    rows: T[];
    meta: PageMeta;
    loading?: boolean;
    /** Localised "showing 1–20 of 64" line rendered under the table. */
    info?: string;
    emptyTitle?: string;
    emptyDescription?: string;
  }>(),
  { loading: false, info: '', emptyTitle: '', emptyDescription: '' },
);

/** `mobile` receives the row type the caller passed in `rows`. */
const slots = defineSlots<{
  default?: () => unknown;
  empty?: () => unknown;
  mobile?: (props: { row: T }) => unknown;
}>();

const isMobile = useMediaQuery(MOBILE_QUERY);

const page = defineModel<number>('page', { default: 1 });

const emit = defineEmits<{ (e: 'change', page: number): void }>();

function onPageChange(next: number) {
  emit('change', next);
}

/** Row identity for the card layout, mirroring what views pass as row-key. */
function rowKey(row: T, index: number) {
  return (row as { id?: string }).id ?? index;
}
</script>

<template>
  <div class="card table-card">
    <!-- Card layout: every field visible without a sideways hunt. -->
    <div v-if="slots.mobile && isMobile" class="records" :aria-busy="loading">
      <template v-if="rows.length">
        <div v-for="(row, i) in rows" :key="rowKey(row, i)" class="record">
          <slot name="mobile" :row="row" />
        </div>
      </template>
      <div v-else class="records-empty">
        <slot name="empty">
          <EmptyState :title="emptyTitle" :description="emptyDescription" />
        </slot>
      </div>
    </div>

    <el-table v-else v-loading="loading" :data="rows" style="width: 100%" v-bind="$attrs">
      <slot />

      <template #empty>
        <slot name="empty">
          <EmptyState :title="emptyTitle" :description="emptyDescription" />
        </slot>
      </template>
    </el-table>

    <div v-if="meta.total > 0" class="pager">
      <span class="muted">{{ info }}</span>
      <el-pagination
        v-model:current-page="page"
        :page-size="meta.pageSize"
        :total="meta.total"
        layout="prev, pager, next"
        background
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.table-card {
  padding: 4px 0 0;
  overflow: hidden;
}

.records {
  display: flex;
  flex-direction: column;
}

.record {
  border-bottom: 1px solid var(--border-light);
}

.record:last-child {
  border-bottom: none;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  font-size: 12px;
}

@media (max-width: 767px) {
  .pager {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--s-2);
  }

  /* Last-resort affordance for views without a #mobile slot: pin the
     identifying column so the row keeps its anchor while scrolling. */
  :deep(.el-table__body tr > td:first-child),
  :deep(.el-table__header th:first-child) {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--surface);
  }
}
</style>
