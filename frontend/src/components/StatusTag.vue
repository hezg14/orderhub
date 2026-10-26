<script setup lang="ts">
import { useI18n } from '@/i18n';
import type { OrderStatus } from '@/types';
import { computed } from 'vue';

const props = defineProps<{ status: OrderStatus }>();
const { t } = useI18n();

/**
 * Colours resolve to CSS variables from tokens.css, so the tag flips with the
 * theme for free. The label comes from i18n so the tag follows the locale —
 * the state machine itself lives in the backend (`lib/order-state.ts`) and
 * must never be duplicated here.
 */
const VAR: Record<OrderStatus, { fg: string; bg: string }> = {
  pending: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  paid: { fg: 'var(--primary)', bg: 'var(--primary-bg)' },
  shipped: { fg: 'var(--info)', bg: 'var(--info-bg)' },
  completed: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: { fg: 'var(--text-secondary)', bg: 'var(--bg-hover)' },
};

const style = computed(() => VAR[props.status]);
const label = computed(() => t(`status.${props.status}`));
</script>

<template>
  <span
    class="tag"
    :style="{
      color: style.fg,
      background: style.bg,
      borderColor: `color-mix(in srgb, ${style.fg} 32%, transparent)`,
    }"
  >
    <i class="dot" :style="{ background: style.fg }" />
    {{ label }}
  </span>
</template>

<style scoped>
.tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 9px;
  border: 1px solid;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
</style>
