<script setup lang="ts">
import { customersApi } from '@/api';
import { ApiError } from '@/api/client';
import DataTable from '@/components/DataTable.vue';
import EmptyState from '@/components/EmptyState.vue';
import MoneyText from '@/components/MoneyText.vue';
import type { Customer, PageMeta } from '@/types';
import { useI18n, localCompany, localName } from '@/i18n';
import { Edit, Plus, Search, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const { t, localeCode } = useI18n();
const router = useRouter();

const rows = ref<Customer[]>([]);
const meta = ref<PageMeta>({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
const page = ref(1);
const loading = ref(true);
const q = ref('');
const sort = ref<'recent' | 'name' | 'spend'>('recent');

const drawer = ref(false);
const editing = ref<Customer | null>(null);
const saving = ref(false);
const form = reactive({ name: '', company: '', phone: '', email: '', address: '', note: '' });

async function load() {
  loading.value = true;
  try {
    const res = await customersApi.list({ page: page.value, pageSize: meta.value.pageSize, q: q.value || undefined, sort: sort.value });
    rows.value = res.data;
    meta.value = res.meta;
  } catch {
    ElMessage.error(t('customers.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', company: '', phone: '', email: '', address: '', note: '' });
  drawer.value = true;
}

function openEdit(row: Customer) {
  editing.value = row;
  Object.assign(form, {
    name: row.name,
    company: row.company ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    note: row.note ?? '',
  });
  drawer.value = true;
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning(t('customers.nameRequired'));
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await customersApi.update(editing.value.id, { ...form });
      ElMessage.success(t('customers.updated'));
    } else {
      await customersApi.create({ ...form });
      ElMessage.success(t('customers.created'));
    }
    drawer.value = false;
    load();
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('customers.saveFailed'));
  } finally {
    saving.value = false;
  }
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(localeCode.value, { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h2>{{ t('customers.title') }}</h2>
        <p class="muted">{{ t('customers.countStat', { total: meta.total }) }}</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">{{ t('customers.newCustomer') }}</el-button>
    </div>

    <div class="card bar">
      <el-input
        v-model="q"
        :placeholder="t('customers.searchPlaceholder')"
        :prefix-icon="Search"
        clearable
        class="w-280"
        @keyup.enter="page = 1; load()"
        @clear="page = 1; load()"
      />
      <el-radio-group v-model="sort" size="default" @change="page = 1; load()">
        <el-radio-button value="recent">{{ t('customers.sortRecent') }}</el-radio-button>
        <el-radio-button value="spend">{{ t('customers.totalSpent') }}</el-radio-button>
        <el-radio-button value="name">{{ t('customers.nameShort') }}</el-radio-button>
      </el-radio-group>
    </div>

    <DataTable
      v-model:page="page"
      :rows="rows"
      :meta="meta"
      :loading="loading"
      :info="t('customers.pagerTotal', { total: meta.total })"
      row-key="id"
      @change="load"
    >
        <el-table-column :label="t('customers.columnCustomer')" min-width="200">
          <template #default="{ row }">
            <div class="cust">
              <div class="avatar">{{ localName(row).slice(0, 1) }}</div>
              <div>
                <router-link :to="`/customers/${row.id}`" class="name">{{ localName(row) }}</router-link>
                <div class="company">{{ localCompany(row) || '—' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="t('customers.contact')" min-width="180">
          <template #default="{ row }">
            <div class="tabular">{{ row.phone || '—' }}</div>
            <div class="sub">{{ row.email || '—' }}</div>
          </template>
        </el-table-column>

        <el-table-column :label="t('customers.orderCount')" width="100" align="right">
          <template #default="{ row }"><span class="tabular">{{ row.orderCount ?? 0 }}</span></template>
        </el-table-column>

        <el-table-column :label="t('customers.totalSpent')" width="140" align="right">
          <template #default="{ row }"><MoneyText :value="row.totalSpent ?? 0" /></template>
        </el-table-column>

        <el-table-column :label="t('customers.lastOrder')" width="130">
          <template #default="{ row }"><span class="muted tabular">{{ fmtDate(row.lastOrderAt) }}</span></template>
        </el-table-column>

        <el-table-column :label="t('common.actions')" width="96" align="right">
          <template #default="{ row }">
            <el-tooltip :content="t('customers.detail')" placement="top">
              <el-button
                link
                type="primary"
                size="small"
                :icon="View"
                :aria-label="t('customers.detail')"
                @click="router.push(`/customers/${row.id}`)"
              />
            </el-tooltip>
            <el-tooltip :content="t('common.edit')" placement="top">
              <el-button
                link
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
              <div class="cust">
                <div class="avatar">{{ localName(row).slice(0, 1) }}</div>
                <div class="rec-id">
                  <router-link :to="`/customers/${row.id}`" class="name">{{ localName(row) }}</router-link>
                  <div class="company">{{ localCompany(row) || '—' }}</div>
                </div>
              </div>
              <MoneyText :value="row.totalSpent ?? 0" class="rec-amount" />
            </div>

            <div class="rec-meta tabular">
              <span>{{ row.phone || '—' }}</span>
              <span class="muted">{{ fmtDate(row.lastOrderAt) }}</span>
            </div>
            <div class="rec-meta muted">{{ row.email || '—' }}</div>

            <div class="rec-row rec-foot">
              <span class="muted">{{ t('customers.orderCount') }} · {{ row.orderCount ?? 0 }}</span>
              <div class="rec-actions">
                <el-button
                  link
                  type="primary"
                  size="small"
                  :icon="View"
                  :aria-label="t('customers.detail')"
                  @click="router.push(`/customers/${row.id}`)"
                />
                <el-button link size="small" :icon="Edit" :aria-label="t('common.edit')" @click="openEdit(row)" />
              </div>
            </div>
          </div>
        </template>

        <template #empty>
          <EmptyState
            :title="q ? t('customers.emptyFiltered') : t('customers.empty')"
            :description="q ? t('customers.emptyFilteredHint') : t('customers.emptyHint')"
          >
            <el-button v-if="!q" type="primary" @click="openCreate">{{ t('customers.newCustomer') }}</el-button>
          </EmptyState>
        </template>
    </DataTable>

    <!-- drawer -->
    <el-drawer v-model="drawer" :title="editing ? t('customers.editCustomer') : t('customers.newCustomer')" size="480px">
      <el-form label-position="top">
        <el-form-item :label="t('customers.name')" required>
          <el-input v-model="form.name" :placeholder="t('customers.namePlaceholder')" maxlength="120" />
        </el-form-item>
        <el-form-item :label="t('customers.companyFull')">
          <el-input v-model="form.company" :placeholder="t('customers.companyPlaceholder')" maxlength="120" />
        </el-form-item>
        <div class="two">
          <el-form-item :label="t('customers.phoneLabel')">
            <el-input v-model="form.phone" placeholder="13800138000" maxlength="40" />
          </el-form-item>
          <el-form-item :label="t('customers.email')">
            <el-input v-model="form.email" placeholder="contact@example.com" maxlength="120" />
          </el-form-item>
        </div>
        <el-form-item :label="t('customers.address')">
          <el-input v-model="form.address" :placeholder="t('customers.addressPlaceholder')" maxlength="300" />
        </el-form-item>
        <el-form-item :label="t('customers.note')">
          <el-input v-model="form.note" type="textarea" :rows="3" maxlength="1000" show-word-limit />
        </el-form-item>
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

.bar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  margin-bottom: var(--s-3);
}

.w-280 {
  width: 280px;
}

.cust {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--primary-bg);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 13px;
  flex: none;
}

.name {
  color: var(--text-primary);
  font-weight: 500;
}

.name:hover {
  color: var(--primary);
}

.company,
.sub {
  font-size: 11px;
  color: var(--text-disabled);
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Phone record: identity and lifetime value first, contact second. */
.rec {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.rec-id .name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rec-amount {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.rec-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
}

.rec-meta .muted {
  margin-left: auto;
}

.rec-foot {
  align-items: center;
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px solid var(--border-light);
  font-size: 12px;
}

.rec-actions {
  display: flex;
  align-items: center;
  gap: 2px;
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
