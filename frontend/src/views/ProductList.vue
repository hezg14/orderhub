<script setup lang="ts">
import { productsApi } from '@/api';
import { ApiError } from '@/api/client';
import DataTable from '@/components/DataTable.vue';
import EmptyState from '@/components/EmptyState.vue';
import MoneyText from '@/components/MoneyText.vue';
import type { PageMeta, Product } from '@/types';
import { useI18n, localCategory, localName } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { Edit, Plus, Search, Warning } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';

const { t } = useI18n();

const LOW_STOCK = 5;

// The backend only lets admins write the catalog (POST/PATCH /products);
// hiding the buttons keeps staff from hitting a 403 they cannot resolve.
const auth = useAuthStore();

const rows = ref<Product[]>([]);
const meta = ref<PageMeta>({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
const categories = ref<{ name: string; count: number }[]>([]);
const page = ref(1);
const loading = ref(true);
const q = ref('');
const category = ref('');
const onlyLow = ref(false);

const drawer = ref(false);
const editing = ref<Product | null>(null);
const saving = ref(false);
const form = reactive({ sku: '', name: '', category: '', unitPrice: 0, stock: 0 });

const tabs = computed(() => [
  { name: '', label: t('common.all'), count: categories.value.reduce((s, c) => s + c.count, 0) },
  ...categories.value.map((c) => ({ name: c.name, label: localCategory(c.name), count: c.count })),
]);

async function load() {
  loading.value = true;
  try {
    const res = await productsApi.list({
      page: page.value,
      pageSize: meta.value.pageSize,
      q: q.value || undefined,
      category: category.value || undefined,
      lowStock: onlyLow.value || undefined,
    });
    rows.value = res.data;
    meta.value = res.meta;
  } catch {
    ElMessage.error(t('products.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function loadCategories() {
  try {
    categories.value = await productsApi.categories();
  } catch {
    // The tab bar is a convenience; the table still works without it.
  }
}

function switchCategory(name: string) {
  category.value = name;
  page.value = 1;
  load();
}

function openCreate() {
  editing.value = null;
  Object.assign(form, { sku: '', name: '', category: category.value || '', unitPrice: 0, stock: 0 });
  drawer.value = true;
}

function openEdit(row: Product) {
  editing.value = row;
  Object.assign(form, {
    sku: row.sku,
    name: row.name,
    category: row.category,
    unitPrice: row.unitPrice,
    stock: row.stock,
  });
  drawer.value = true;
}

async function save() {
  if (!form.sku.trim() || !form.name.trim() || !form.category.trim()) {
    ElMessage.warning(t('products.requiredFields'));
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await productsApi.update(editing.value.id, { ...form });
      ElMessage.success(t('products.updated'));
    } else {
      await productsApi.create({ ...form });
      ElMessage.success(t('products.created'));
    }
    drawer.value = false;
    await Promise.all([load(), loadCategories()]);
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('products.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  load();
  loadCategories();
});
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h2>{{ t('products.title') }}</h2>
        <p class="muted">{{ t('products.countStat', { total: meta.total, n: LOW_STOCK }) }}</p>
      </div>
      <el-button v-if="auth.isAdmin" type="primary" :icon="Plus" @click="openCreate">{{ t('products.newProduct') }}</el-button>
    </div>

    <div class="tabs">
      <button
        v-for="tb in tabs"
        :key="tb.name || 'all'"
        type="button"
        class="tab"
        :class="{ on: category === tb.name }"
        @click="switchCategory(tb.name)"
      >
        {{ tb.label }}<span class="count">{{ tb.count }}</span>
      </button>
    </div>

    <div class="card bar">
      <el-input
        v-model="q"
        :placeholder="t('products.searchPlaceholder')"
        :prefix-icon="Search"
        clearable
        class="w-280"
        @keyup.enter="page = 1; load()"
        @clear="page = 1; load()"
      />
      <el-checkbox v-model="onlyLow" @change="page = 1; load()">{{ t('products.lowStockOnly') }}</el-checkbox>
    </div>

    <DataTable
      v-model:page="page"
      :rows="rows"
      :meta="meta"
      :loading="loading"
      :info="t('products.pagerTotal', { total: meta.total })"
      row-key="id"
      @change="load"
    >
        <el-table-column :label="t('products.columnProduct')" min-width="240">
          <template #default="{ row }">
            <div class="pname">{{ localName(row) }}</div>
            <div class="sku mono">{{ row.sku }}</div>
          </template>
        </el-table-column>

        <el-table-column :label="t('products.category')" width="120">
          <template #default="{ row }"><span class="cat">{{ localCategory(row.category) }}</span></template>
        </el-table-column>

        <el-table-column :label="t('products.price')" width="120" align="right">
          <template #default="{ row }"><MoneyText :value="row.unitPrice" /></template>
        </el-table-column>

        <el-table-column :label="t('products.stock')" width="150" align="right">
          <template #default="{ row }">
            <div class="stock" :class="{ low: row.stock <= LOW_STOCK }">
              <span class="tabular">{{ row.stock }}</span>
              <span v-if="row.stock <= LOW_STOCK" class="low-tag">
                <el-icon><Warning /></el-icon>{{ t('products.lowStock') }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column v-if="auth.isAdmin" :label="t('common.actions')" width="72" align="right">
          <template #default="{ row }">
            <el-tooltip :content="t('common.edit')" placement="top">
              <el-button
                link
                type="primary"
                size="small"
                :icon="Edit"
                :aria-label="t('common.edit')"
                @click="openEdit(row)"
              />
            </el-tooltip>
          </template>
        </el-table-column>

        <template #mobile="{ row }">
          <div class="rec">
            <div class="rec-row">
              <div class="rec-id">
                <div class="pname">{{ localName(row) }}</div>
                <div class="sku mono">{{ row.sku }}</div>
              </div>
              <MoneyText :value="row.unitPrice" class="rec-amount" />
            </div>
            <div class="rec-row rec-foot">
              <span class="cat">{{ localCategory(row.category) }}</span>
              <div class="rec-actions">
                <span class="stock" :class="{ low: row.stock <= LOW_STOCK }">
                  <span class="tabular">{{ row.stock }}</span>
                  <span v-if="row.stock <= LOW_STOCK" class="low-tag">
                    <el-icon><Warning /></el-icon>{{ t('products.lowStock') }}
                  </span>
                </span>
                <el-button v-if="auth.isAdmin" link type="primary" size="small" :icon="Edit" :aria-label="t('common.edit')" @click="openEdit(row)" />
              </div>
            </div>
          </div>
        </template>

        <template #empty>
          <EmptyState
            :title="q || onlyLow ? t('products.emptyFiltered') : t('products.empty')"
            :description="t('products.emptyHint')"
          >
            <el-button v-if="auth.isAdmin" type="primary" @click="openCreate">{{ t('products.newProduct') }}</el-button>
          </EmptyState>
        </template>
    </DataTable>

    <el-drawer v-model="drawer" :title="editing ? t('products.editProduct') : t('products.newProduct')" size="460px">
      <el-form label-position="top">
        <div class="two">
          <el-form-item label="SKU" required>
            <el-input v-model="form.sku" placeholder="ELE-4013" maxlength="40" />
          </el-form-item>
          <el-form-item :label="t('products.category')" required>
            <el-input v-model="form.category" :placeholder="t('products.categoryPlaceholder')" maxlength="60" />
          </el-form-item>
        </div>
        <el-form-item :label="t('products.name')" required>
          <el-input v-model="form.name" :placeholder="t('products.name')" maxlength="160" />
        </el-form-item>
        <div class="two">
          <el-form-item :label="t('products.priceCurrency')">
            <el-input-number v-model="form.unitPrice" :min="0" :precision="2" :step="1" controls-position="right" class="full" />
          </el-form-item>
          <el-form-item :label="t('products.stock')">
            <el-input-number v-model="form.stock" :min="0" :step="1" controls-position="right" class="full" />
          </el-form-item>
        </div>
        <el-alert
          v-if="editing"
          type="info"
          :closable="false"
          :title="t('products.stockAuditTitle')"
          :description="t('products.stockAuditDesc')"
        />
      </el-form>

      <template #footer>
        <el-button @click="drawer = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ t('common.save') }}</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
/* .head styles come from tokens.css — the shared page-header pattern. */

.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: var(--s-3);
  overflow-x: auto;
  padding-bottom: 2px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  border-radius: var(--r-pill);
  font-size: 13px;
  font-family: inherit;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.tab.on {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.count {
  font-size: 11px;
  opacity: 0.7;
}

.bar {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  margin-bottom: var(--s-3);
}

.w-280 {
  width: 280px;
}

.pname {
  font-weight: 500;
}

.sku {
  font-size: 11px;
  color: var(--text-disabled);
}

.cat {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.stock {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.stock.low {
  color: var(--danger);
  font-weight: 600;
}

.low-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--r-pill);
  background: var(--danger-bg);
  color: var(--danger);
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.full {
  width: 100%;
}

/* Phone record: stock is the field that decides whether someone acts, so it
   sits on the same line as the price rather than off-screen. */
.rec {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}

.rec-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.rec-id {
  min-width: 0;
}

.rec-amount {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.rec-foot {
  align-items: center;
}

.rec-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-actions .stock {
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .bar {
    flex-direction: column;
    align-items: stretch;
  }

  .w-280 {
    width: 100%;
  }
}
</style>
