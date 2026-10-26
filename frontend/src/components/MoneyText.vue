<script setup lang="ts">
import { currentLocale } from '@/i18n';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number | null | undefined;
    prefix?: string;
    decimals?: number;
    sign?: boolean;
    muted?: boolean;
  }>(),
  { prefix: '¥', decimals: 2, sign: false, muted: false },
);

const formatted = computed(() => {
  // Prisma Decimal arrives as a string over JSON, so coerce rather than trust the type.
  const n = Number(props.value ?? 0);
  return n.toLocaleString(currentLocale() === 'zh' ? 'zh-CN' : 'en-US', {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
  });
});
</script>

<template>
  <span class="money" :class="{ muted }">
    <span v-if="sign && Number(value) > 0" class="plus">+</span>{{ prefix }}{{ formatted }}
  </span>
</template>

<style scoped>
.money {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.muted {
  color: var(--text-secondary);
}

.plus {
  color: var(--success);
}
</style>
