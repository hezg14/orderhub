<script setup lang="ts">
import { ordersApi } from '@/api';
import { ApiError } from '@/api/client';
import MoneyText from '@/components/MoneyText.vue';
import StatusFlow from '@/components/StatusFlow.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useAuthStore } from '@/stores/auth';
import type { OrderDetail, OrderStatus } from '@/types';
import { useI18n, localCompany, localName } from '@/i18n';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { ArrowRight, Delete, Printer } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const { t, localeCode } = useI18n();
const isMobile = useMediaQuery(MOBILE_QUERY);
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const order = ref<OrderDetail | null>(null);
const loading = ref(true);
const busy = ref(false);
const notFound = ref(false);

const transitions = ref<Record<OrderStatus, OrderStatus[]>>({
  pending: [],
  paid: [],
  shipped: [],
  completed: [],
  cancelled: [],
});

const allowed = computed(() => (order.value ? transitions.value[order.value.status] : []));

/** Cancelling is owner-only, so the button is filtered out for staff. */
const actions = computed(() =>
  allowed.value.filter((s) => s !== 'cancelled' || auth.isAdmin),
);

const canDelete = computed(
  () => auth.isAdmin && order.value?.status === 'pending',
);

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    const [detail, meta] = await Promise.all([
      ordersApi.get(route.params.id as string),
      ordersApi.transitions(),
    ]);
    order.value = detail;
    transitions.value = meta.transitions;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound.value = true;
    else ElMessage.error(t('orderDetail.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * One primary button per screen: the forward transition is always brand colour,
 * whatever the target state. Three different saturated buttons (green / amber /
 * red) in a sidebar read as decoration and compete with the record itself.
 */
const ACTION_TYPE: Record<string, 'primary' | 'danger'> = {
  paid: 'primary',
  shipped: 'primary',
  completed: 'primary',
  cancelled: 'danger',
};

async function move(next: OrderStatus) {
  if (!order.value) return;

  if (next === 'cancelled') {
    try {
      await ElMessageBox.confirm(
        t('orderDetail.cancelBody'),
        t('orderDetail.cancelTitle'),
        { confirmButtonText: t('orderDetail.cancelConfirm'), cancelButtonText: t('common.back'), type: 'warning' },
      );
    } catch {
      return;
    }
  }

  busy.value = true;
  try {
    await ordersApi.changeStatus(order.value.id, next);
    ElMessage.success(t('orderDetail.updated', { status: t('status.' + next) }));
    await load();
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('orderDetail.updateFailed'));
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!order.value) return;
  try {
    await ElMessageBox.confirm(
      t('orderDetail.deleteBody', { orderNo: order.value.orderNo }),
      t('orderDetail.deleteTitle'),
      { confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel'), type: 'warning' },
    );
  } catch {
    return;
  }

  try {
    await ordersApi.remove(order.value.id);
    ElMessage.success(t('orderDetail.deleted'));
    router.replace('/orders');
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('orderDetail.deleteFailed'));
  }
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(localeCode.value, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

// Vue templates cannot reach `window` directly, so expose a handler.
const printPage = () => window.print();

function describe(detail: Record<string, unknown>): string {
  if (detail.field === 'status' && detail.from && detail.to) {
    const from = t('status.' + (detail.from as OrderStatus));
    const to = t('status.' + (detail.to as OrderStatus));
    const base = t('orderDetail.statusChange', { from, to });
    return detail.reason ? t('orderDetail.withReason', { base, reason: String(detail.reason) }) : base;
  }
  if (detail.changes && typeof detail.changes === 'object') {
    const fields = Object.keys(detail.changes as object).join(', ');
    return t('audit.fieldsChanged', { fields });
  }
  return t('orderDetail.describeFallback');
}

onMounted(load);
</script>

<template>
  <div class="page">
    <el-skeleton v-if="loading" :rows="10" animated />

    <el-result
      v-else-if="notFound"
      icon="warning"
      :title="t('orderDetail.notFound')"
      :sub-title="t('orderDetail.notFoundHint')"
    >
      <template #extra>
        <el-button type="primary" @click="router.push('/orders')">{{ t('orderDetail.backToOrders') }}</el-button>
      </template>
    </el-result>

    <template v-else-if="order">
      <!-- header -->
      <div class="head no-print">
        <router-link to="/orders" class="back">‹ {{ t('orderDetail.backToOrders') }}</router-link>
        <div class="head-row">
          <div>
            <div class="title-row">
              <h2 class="mono">{{ order.orderNo }}</h2>
              <StatusTag :status="order.status" />
            </div>
            <p class="muted">{{ t('orderDetail.subtitle', { date: fmt(order.createdAt) }) }}<span v-if="order.creator"> · {{ localName(order.creator) }}</span></p>
          </div>

          <div class="head-actions">
            <el-button :icon="Printer" @click="printPage">{{ t('common.print') }}</el-button>
            <el-button v-if="canDelete" :icon="Delete" type="danger" plain @click="remove">{{ t('common.delete') }}</el-button>
          </div>
        </div>
      </div>

      <!-- The pipeline, above the fold: how far this order has travelled. -->
      <div class="card flow-card">
        <StatusFlow :status="order.status" />
      </div>

      <div class="layout">
        <div class="left">
          <!-- items -->
          <div class="card">
            <div class="card-head">
              <h3>{{ t('orderDetail.lines') }}</h3>
              <span class="muted">{{ t('orderDetail.linesCount', { n: order.items.length }) }}</span>
            </div>

            <el-table v-if="!isMobile" :data="order.items" style="width: 100%">
              <el-table-column :label="t('orderDetail.product')" min-width="220">
                <template #default="{ row }">
                  <div class="pname">{{ row.product ? localName(row.product) : row.productId }}</div>
                  <div class="psku mono">{{ row.product?.sku }}</div>
                </template>
              </el-table-column>
              <el-table-column :label="t('orderDetail.unitPrice')" width="110" align="right">
                <template #default="{ row }"><MoneyText :value="row.unitPrice" /></template>
              </el-table-column>
              <el-table-column :label="t('orderDetail.quantity')" width="90" align="right">
                <template #default="{ row }"><span class="tabular">{{ row.quantity }}</span></template>
              </el-table-column>
              <el-table-column :label="t('orderDetail.lineTotal')" width="120" align="right">
                <template #default="{ row }"><MoneyText :value="row.subtotal" /></template>
              </el-table-column>
            </el-table>

            <ul v-else class="item-list">
              <li v-for="row in order.items" :key="row.id" class="item-rec">
                <div class="item-row">
                  <div class="pname">{{ row.product ? localName(row.product) : row.productId }}</div>
                  <MoneyText :value="row.subtotal" class="item-amount" />
                </div>
                <div class="item-row item-sub mono">
                  <span>{{ row.product?.sku }}</span>
                  <span class="muted">{{ row.quantity }} × <MoneyText :value="row.unitPrice" /></span>
                </div>
              </li>
            </ul>

            <div class="totals">
              <div><span>{{ t('orderDetail.subtotal') }}</span><MoneyText :value="order.subtotal" /></div>
              <div><span>{{ t('orderDetail.discount') }}</span><span class="neg">−<MoneyText :value="order.discount" /></span></div>
              <div class="grand"><span>{{ t('orderDetail.total') }}</span><MoneyText :value="order.total" /></div>
            </div>
          </div>

          <!-- timeline -->
          <div class="card">
            <div class="card-head"><h3>{{ t('orderDetail.timeline') }}</h3></div>
            <div class="timeline">
              <el-timeline v-if="order.timeline?.length">
                <el-timeline-item
                  v-for="log in order.timeline"
                  :key="log.id"
                  :timestamp="fmt(log.createdAt)"
                  placement="top"
                  :type="log.action === 'delete' ? 'danger' : log.action === 'create' ? 'success' : 'primary'"
                >
                  <div class="log">
                    <b>{{ log.user ? localName(log.user) : t('orderDetail.system') }}</b>
                    <span class="log-action">{{ describe(log.detail) }}</span>
                  </div>
                  <div v-if="log.requestId" class="req mono">req {{ log.requestId.slice(0, 8) }}</div>
                </el-timeline-item>
              </el-timeline>
              <p v-else class="muted small">{{ t('orderDetail.noTimeline') }}</p>
            </div>
          </div>
        </div>

        <!-- sidebar -->
        <aside class="right">
          <div class="card pad">
            <h3>{{ t('orderDetail.customerInfo') }}</h3>
            <router-link :to="`/customers/${order.customerId}`" class="cust-name">
              {{ order.customer ? localName(order.customer) : '' }}
            </router-link>
            <dl class="kv">
              <div><dt>{{ t('orderDetail.company') }}</dt><dd>{{ order.customer ? (localCompany(order.customer) || '—') : '—' }}</dd></div>
              <div><dt>{{ t('orderDetail.phone') }}</dt><dd>{{ order.customer?.phone || '—' }}</dd></div>
              <div><dt>{{ t('orderDetail.email') }}</dt><dd class="break">{{ order.customer?.email || '—' }}</dd></div>
              <div><dt>{{ t('orderDetail.address') }}</dt><dd class="break">{{ order.customer?.address || '—' }}</dd></div>
            </dl>
          </div>

          <div class="card pad no-print">
            <h3>{{ t('orderDetail.statusFlow') }}</h3>
            <p class="muted small">{{ t('orderDetail.flowHint') }}</p>

            <div v-if="actions.length" class="actions">
              <el-button
                v-for="next in actions"
                :key="next"
                :type="ACTION_TYPE[next]"
                :plain="next === 'cancelled'"
                :loading="busy"
                class="full"
                @click="move(next)"
              >
                {{ t('orderDetail.advance', { status: t('status.' + next) }) }}
                <el-icon class="ml"><ArrowRight /></el-icon>
              </el-button>
            </div>

            <p v-else class="muted small">
              {{ order.status === 'completed' || order.status === 'cancelled'
                ? t('orderDetail.terminalState')
                : t('orderDetail.noActions') }}
            </p>

            <el-alert
              v-if="order.status === 'pending' && !auth.isAdmin"
              type="info"
              :closable="false"
              :title="t('orderDetail.cancelAdminOnly')"
              class="mt"
            />
          </div>

          <div v-if="order.note" class="card pad">
            <h3>{{ t('orderDetail.note') }}</h3>
            <p class="note">{{ order.note }}</p>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.back {
  font-size: 13px;
  color: var(--text-secondary);
}

.head {
  margin-bottom: var(--s-5);
}

.head-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-top: 6px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-row h2 {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.01em;
}

.head-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--s-5);
  align-items: start;
}

.flow-card {
  margin-bottom: var(--s-5);
  padding: 6px 10px 2px;
}

.left,
.right {
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 16px 20px 10px;
}


.card-head .muted {
  font-size: 12px;
}

.pname {
  font-weight: 500;
}

.psku {
  font-size: 11px;
  color: var(--text-disabled);
}

.totals {
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-items: flex-end;
}

.totals > div {
  display: flex;
  gap: 32px;
  font-size: 13px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.totals > div span:first-child {
  min-width: 40px;
  text-align: right;
}

.neg {
  color: var(--danger);
}

.grand {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 16px !important;
  font-weight: 600;
  color: var(--text-primary) !important;
}

.timeline {
  padding: 4px 20px 20px;
}

.log {
  font-size: 13px;
  display: flex;
  gap: 8px;
}

.log-action {
  color: var(--text-secondary);
}

.req {
  font-size: 11px;
  color: var(--text-disabled);
  margin-top: 2px;
}

.pad {
  padding: 18px 20px;
}

.pad h3 {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.cust-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.kv {
  margin: 12px 0 0;
}

.kv > div {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  font-size: 12px;
}

.kv dt {
  width: 52px;
  flex: none;
  color: var(--text-disabled);
}

.kv dd {
  margin: 0;
  color: var(--text-primary);
}

.break {
  word-break: break-all;
}

.small {
  font-size: 12px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.full {
  width: 100%;
}

.ml {
  margin-left: 4px;
}

.mt {
  margin-top: 12px;
}

.note {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

@media (max-width: 1023px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

/* Phone order detail. The desktop header assumed one row for back link, title
   and actions; at 390px that squeezed "Back to orders" into a word-per-line
   column and broke the order number across two lines. */
@media (max-width: 767px) {
  .back {
    display: inline-block;
    white-space: nowrap;
    margin-bottom: 8px;
  }

  .head-row {
    flex-direction: column;
    gap: 10px;
  }

  .title-row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .title-row h2 {
    font-size: 19px;
    white-space: nowrap;
  }

  /* The global page-header marker belongs before a page title; here the h2 is
     an order number, and the block just floats in front of the digits. */
  .title-row h2::before {
    display: none;
  }

  .head-actions {
    margin-left: 0;
    width: 100%;
  }

  .head-actions .el-button {
    flex: 1;
  }

  /* Line items as records: product + amount, then sku × qty at unit price. */
  .item-list {
    list-style: none;
    margin: 0;
    padding: 0 16px;
  }

  .item-rec {
    padding: 12px 0;
    border-top: 1px solid var(--border-light);
  }

  .item-rec:first-child {
    border-top: none;
  }

  .item-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .item-amount {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }

  .item-sub {
    margin-top: 3px;
    font-size: 11px;
  }

  .totals > div {
    gap: 20px;
  }

  /* The timeline's actor + action sat on one unwrapped flex row and clipped. */
  .log {
    flex-direction: column;
    gap: 1px;
  }

  .log-action {
    word-break: break-word;
  }
}
</style>
