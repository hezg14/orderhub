<script setup lang="ts">
import { useCountUp } from '@/composables/useCountUp';
import { useI18n } from '@/i18n';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    /** When provided, the number animates (count-up) and overrides `value`. */
    numeric?: number | null;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    delta?: number | null;
    deltaLabel?: string;
    hint?: string;
    loading?: boolean;
    accent?: 'default' | 'warning' | 'success';
  }>(),
  {
    numeric: null,
    prefix: '',
    suffix: '',
    decimals: 0,
    delta: null,
    deltaLabel: '',
    hint: '',
    loading: false,
    accent: 'default',
  },
);

const emit = defineEmits<{ (e: 'select'): void }>();

const { localeCode } = useI18n();

// Count-up on every data change — the value "lands" instead of teleporting.
const target = computed(() => (typeof props.numeric === 'number' ? props.numeric : null));
const animated = useCountUp(target);

const shownValue = computed(() => {
  if (target.value === null) return props.value;
  const formatted = animated.value.toLocaleString(localeCode.value, {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
  });
  return `${props.prefix}${formatted}`;
});
</script>

<template>
  <component
    :is="loading ? 'div' : 'button'"
    class="stat"
    :class="[`accent-${accent}`, { loading }]"
    type="button"
    @click="!loading && emit('select')"
  >
    <div class="label">{{ label }}</div>

    <div v-if="loading" class="sk-value skeleton" />
    <div v-else class="value tabular">
      {{ shownValue }}<span v-if="suffix" class="suffix">{{ suffix }}</span>
    </div>

    <div v-if="loading" class="sk-hint skeleton" />
    <div v-else class="foot">
      <span
        v-if="delta !== null"
        class="delta"
        :class="delta >= 0 ? 'up' : 'down'"
      >{{ delta >= 0 ? '↑' : '↓' }} {{ Math.abs(delta) }}%</span>
      <span v-if="deltaLabel" class="delta-label">{{ deltaLabel }}</span>
      <span v-if="hint" class="hint">{{ hint }}</span>
    </div>
  </component>
</template>

<style scoped>
.stat {
  position: relative;
  display: block;
  width: 100%;
  text-align: left;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-card);
  font-family: inherit;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease);
}

.stat:hover:not(.loading) {
  border-color: var(--primary-border);
}

/* The card is clickable — surface that with a quiet arrow on hover. */
.stat::after {
  content: '↗';
  position: absolute;
  top: 12px;
  right: 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
  opacity: 0;
  transform: translate(-4px, 4px);
  transition: opacity var(--t-fast) var(--ease), transform var(--t-fast) var(--ease);
  pointer-events: none;
}

.stat:hover:not(.loading)::after {
  opacity: 1;
  transform: none;
}

.stat:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.stat.loading {
  cursor: default;
}

.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-disabled);
}

.value {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 27px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.suffix {
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 5px;
  letter-spacing: 0;
}

.foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  min-height: 18px;
  font-size: 12px;
  color: var(--text-disabled);
}

.delta {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.delta.up {
  color: var(--success);
}

.delta.down {
  color: var(--danger);
}

.accent-warning .value {
  color: var(--warning);
}

.accent-success .value {
  color: var(--success);
}

.sk-value {
  margin-top: 8px;
  width: 96px;
  height: 28px;
}

.sk-hint {
  margin-top: 8px;
  width: 64px;
  height: 12px;
}

/* Phones get two tiles per row: a single column turns four readouts into a
   four-screen scroll. Type steps down with the container, not with taste. */
@media (max-width: 767px) {
  .stat {
    padding: 12px 13px;
  }

  .value {
    font-size: 21px;
  }

  .label {
    font-size: 10px;
    letter-spacing: 0.06em;
  }

  .foot {
    font-size: 11px;
  }
}
</style>
