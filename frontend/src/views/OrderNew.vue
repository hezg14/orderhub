<script setup lang="ts">
import { customersApi, ordersApi, productsApi } from '@/api';
import { ApiError } from '@/api/client';
import MoneyText from '@/components/MoneyText.vue';
import PageHeader from '@/components/PageHeader.vue';
import type { Customer, Product } from '@/types';
import { useI18n, localCompany, localName } from '@/i18n';
import { fmtMoney } from '@/utils/format';
import { Delete, Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

interface Line {
  key: number;
  productId: string;
  quantity: number;
}

let lineKey = 0;
const items = ref<Line[]>([{ key: ++lineKey, productId: '', quantity: 1 }]);

const customers = ref<Customer[]>([]);
const products = ref<Product[]>([]);
const form = reactive({ customerId: '', discount: 0, note: '' });
const submitting = ref(false);
const serverError = ref('');

const productMap = computed(() => new Map(products.value.map((p) => [p.id, p])));

const lines = computed(() =>
  items.value.map((item) => {
    const product = productMap.value.get(item.productId);
    const unitPrice = product?.unitPrice ?? 0;
    const stock = product?.stock ?? 0;
    return {
      ...item,
      product,
      unitPrice,
      subtotal: unitPrice * item.quantity,
      overStock: Boolean(product) && item.quantity > stock,
    };
  }),
);

const subtotal = computed(() => lines.value.reduce((sum, l) => sum + l.subtotal, 0));
const total = computed(() => Math.max(0, subtotal.value - Number(form.discount || 0)));

const discountTooBig = computed(() => Number(form.discount || 0) > subtotal.value);
const hasOverStock = computed(() => lines.value.some((l) => l.overStock));
const hasEmptyLine = computed(() => lines.value.some((l) => !l.productId));

const canSubmit = computed(
  () =>
    Boolean(form.customerId) &&
    items.value.length > 0 &&
    !hasOverStock.value &&
    !hasEmptyLine.value &&
    !discountTooBig.value &&
    !submitting.value,
);

function addLine() {
  items.value.push({ key: ++lineKey, productId: '', quantity: 1 });
}

function removeLine(key: number) {
  if (items.value.length === 1) {
    ElMessage.warning(t('orderNew.keepOneLine'));
    return;
  }
  items.value = items.value.filter((i) => i.key !== key);
}

function onProductChange(line: Line) {
  // Two lines of the same product would each pass the stock check on the client
  // while the server merges them; surface that here so the user is not surprised.
  const dup = items.value.filter((i) => i.productId === line.productId);
  if (line.productId && dup.length > 1) {
    ElMessage.warning(t('orderNew.duplicateProduct'));
  }
}

async function submit() {
  if (!canSubmit.value) return;

  submitting.value = true;
  serverError.value = '';

  try {
    const order = await ordersApi.create({
      customerId: form.customerId,
      discount: Number(form.discount || 0),
      note: form.note || undefined,
      items: items.value.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    ElMessage.success(t('orderNew.created', { orderNo: order.orderNo }));
    router.replace(`/orders/${order.id}`);
  } catch (err) {
    if (err instanceof ApiError) {
      serverError.value = creditMessage(err) ?? err.message;
      // 409 carries per-product availability: refresh stock so the red rows are right.
      if (err.code === 'CONFLICT') {
        products.value = (await productsApi.list({ pageSize: 100 })).data;
      }
      // A just-rejected order also means the customer's receivable moved.
      if (err.code === 'BUSINESS_RULE_VIOLATION') {
        customers.value = (await customersApi.list({ pageSize: 100 })).data;
      }
    } else {
      serverError.value = t('orderNew.failed');
    }
  } finally {
    submitting.value = false;
  }
}

/** Localized, numbers-and-all rendering of a CREDIT_LIMIT_EXCEEDED rejection. */
function creditMessage(err: ApiError): string | null {
  const d = err.details as
    | {
        reason?: string;
        creditLimit?: number;
        receivable?: number;
        attemptedTotal?: number;
        shortfall?: number;
      }
    | undefined;
  if (err.code !== 'BUSINESS_RULE_VIOLATION' || d?.reason !== 'CREDIT_LIMIT_EXCEEDED') return null;
  return t('orderNew.creditExceeded', {
    limit: fmtMoney(d.creditLimit ?? 0),
    receivable: fmtMoney(d.receivable ?? 0),
    attempted: fmtMoney(d.attemptedTotal ?? 0),
    shortfall: fmtMoney(d.shortfall ?? 0),
  });
}

onMounted(async () => {
  try {
    const [c, p] = await Promise.all([
      customersApi.list({ pageSize: 100 }),
      productsApi.list({ pageSize: 100 }),
    ]);
    customers.value = c.data;
    products.value = p.data;

    // Arriving from a customer detail page pre-selects that customer.
    const preset = route.query.customerId;
    if (typeof preset === 'string' && c.data.some((x) => x.id === preset)) {
      form.customerId = preset;
    }
  } catch {
    ElMessage.error(t('orderNew.loadFailed'));
  }
});
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('orderNew.title')"
      :description="t('orderNew.subtitle')"
      back-to="/orders"
    />

    <el-alert
      v-if="serverError"
      type="error"
      :title="serverError"
      show-icon
      :closable="false"
      class="mb"
    />

    <div class="layout">
      <div class="card main-col">
        <!-- customer -->
        <section class="block">
          <h3>{{ t('orderNew.customer') }}</h3>
          <el-select
            v-model="form.customerId"
            filterable
            :placeholder="t('orderNew.customerPlaceholder')"
            class="full"
            size="large"
          >
            <el-option v-for="c in customers" :key="c.id" :label="localName(c)" :value="c.id">
              <div class="opt">
                <span>{{ localName(c) }}</span>
                <span class="opt-sub">{{ localCompany(c) }}</span>
              </div>
            </el-option>
          </el-select>
        </section>

        <!-- items -->
        <section class="block">
          <div class="block-head">
            <h3>{{ t('orderNew.lines') }}</h3>
            <el-button :icon="Plus" size="small" @click="addLine">{{ t('orderNew.addLine') }}</el-button>
          </div>

          <div class="lines">
            <div class="line-head">
              <span>{{ t('orderNew.product') }}</span><span>{{ t('orderNew.unitPrice') }}</span><span>{{ t('orderNew.quantity') }}</span><span class="r">{{ t('orderNew.lineTotal') }}</span><span />
            </div>

            <div v-for="line in lines" :key="line.key" class="line" :class="{ bad: line.overStock }">
              <el-select
                v-model="line.productId"
                filterable
                :placeholder="t('orderNew.productPlaceholder')"
                class="prod"
                @change="onProductChange(line)"
              >
                <el-option
                  v-for="p in products"
                  :key="p.id"
                  :label="localName(p)"
                  :value="p.id"
                  :disabled="p.stock === 0"
                >
                  <div class="opt">
                    <span>{{ localName(p) }}</span>
                    <span class="opt-sub mono">{{ p.sku }} · {{ t('orderNew.stock') }} {{ p.stock }}</span>
                  </div>
                </el-option>
              </el-select>

              <div class="price tabular">
                <MoneyText :value="line.unitPrice" />
              </div>

              <el-input-number
                v-model="line.quantity"
                :min="1"
                :max="99999"
                size="default"
                controls-position="right"
                class="qty"
              />

              <div class="line-total tabular r">
                <MoneyText :value="line.subtotal" />
              </div>

              <el-button link type="danger" :icon="Delete" @click="removeLine(line.key)" />
            </div>
          </div>

          <p v-if="hasOverStock" class="err">
            {{ t('orderNew.overStockSummary') }}
          </p>
        </section>

        <!-- note -->
        <section class="block">
          <h3>{{ t('orderNew.noteSection') }}</h3>
          <div class="two">
            <el-input
              v-model="form.note"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              :placeholder="t('orderNew.notePlaceholder')"
            />
            <div class="discount">
              <label>{{ t('orderNew.discount') }}</label>
              <el-input-number v-model="form.discount" :min="0" :step="10" :precision="2" controls-position="right" />
              <p v-if="discountTooBig" class="err">{{ t('orderNew.discountTooBig') }}</p>
            </div>
          </div>
        </section>
      </div>

      <!-- summary -->
      <aside class="card summary">
        <h3>{{ t('orderNew.summary') }}</h3>

        <dl class="rows">
          <div><dt>{{ t('orderNew.lineLabel') }}</dt><dd>{{ t('orderNew.lineCount', { n: items.length }) }}</dd></div>
          <div><dt>{{ t('orderNew.subtotal') }}</dt><dd><MoneyText :value="subtotal" /></dd></div>
          <div><dt>{{ t('orderNew.discount') }}</dt><dd class="discount-cell">−<MoneyText :value="Number(form.discount || 0)" /></dd></div>
          <div class="total"><dt>{{ t('orderNew.total') }}</dt><dd><MoneyText :value="total" /></dd></div>
        </dl>

        <el-button
          type="primary"
          size="large"
          class="full"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ submitting ? t('orderNew.submitting') : t('orderNew.submit') }}
        </el-button>

        <p class="tip">{{ t('orderNew.tip') }}</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.mb {
  margin-bottom: var(--s-4);
}

.layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--s-5);
  align-items: start;
}

.block {
  padding: 20px 22px;
}

.block + .block {
  border-top: 1px solid var(--border-light);
}

.block h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.block-head {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.block-head h3 {
  margin: 0;
}

.block-head .el-button {
  margin-left: auto;
}

.full {
  width: 100%;
}

.opt {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.opt-sub {
  color: var(--text-disabled);
  font-size: 12px;
}

.lines {
  border: 1px solid var(--border);
  border-radius: var(--r-control);
  overflow: hidden;
}

.line-head,
.line {
  display: grid;
  grid-template-columns: 1fr 110px 130px 110px 44px;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
}

.line-head {
  background: var(--bg-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.line + .line {
  border-top: 1px solid var(--border-light);
}

.line.bad {
  background: var(--danger-bg);
}

.price,
.line-total {
  font-size: 13px;
  color: var(--text-secondary);
}

.r {
  text-align: right;
}

.qty {
  width: 100%;
}

.err {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--danger);
}

.two {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 16px;
  align-items: start;
}

.discount label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.summary {
  position: sticky;
  top: calc(var(--header-h) + 20px);
  padding: 20px;
}

.summary h3 {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
}

.rows {
  margin: 0 0 18px;
}

.rows > div {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 13px;
}

.rows dt {
  color: var(--text-secondary);
}

.rows dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.discount-cell {
  color: var(--danger);
}

.total {
  margin-top: 6px;
  padding-top: 12px !important;
  border-top: 1px solid var(--border);
  font-size: 15px !important;
  font-weight: 600;
}

.total dd {
  font-size: 20px;
  letter-spacing: -0.02em;
}

.tip {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-disabled);
}

@media (max-width: 1023px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .summary {
    position: static;
  }
}

@media (max-width: 767px) {
  .line-head {
    display: none;
  }

  /* Phone line item: the product picker gets its own full-width row (a 150px
     column clipped every product name), then quantity, line total and delete
     share one row. The unit price is dropped — it is already reflected in the
     line total and was only costing width. */
  .line {
    grid-template-columns: auto 1fr auto;
    column-gap: 10px;
    row-gap: 8px;
  }

  .line .prod {
    grid-column: 1 / -1;
  }

  .line .price {
    display: none;
  }

  .line .qty {
    width: 118px;
  }

  .line .line-total {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .two {
    grid-template-columns: 1fr;
  }
}
</style>
