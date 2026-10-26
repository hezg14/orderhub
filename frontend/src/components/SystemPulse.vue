<script setup lang="ts">
import { useApiTelemetry } from '@/composables/useApiTelemetry';
import { useI18n } from '@/i18n';
import { computed } from 'vue';

/**
 * API lamp: an honest read-out of the traffic the app is already making.
 *
 * This is the kind of detail that separates an operations console from a
 * marketing dashboard — it tells you the system is alive, with a number, not
 * with a green icon and a shrug.
 */
const { t, localeCode } = useI18n();
const { latency, lastOkAt, errors } = useApiTelemetry();

const state = computed(() => {
  if (errors.value > 0) return 'warn';
  if (latency.value === null) return 'idle';
  if (latency.value > 800) return 'warn';
  return 'ok';
});

const tip = computed(() => {
  const last = lastOkAt.value;
  const time = last
    ? new Date(last).toLocaleTimeString(localeCode.value, {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';
  return `${t('system.apiLabel')} · ${last ? t('system.lastSync', { time }) : t('system.idle')}`;
});
</script>

<template>
  <el-tooltip :content="tip" placement="bottom">
    <div class="lamp" :class="state" role="status" :aria-label="tip">
      <span class="led" />
      <span class="lamp-k">API</span>
      <span class="lamp-v">{{ latency === null ? '—' : latency }}<i>ms</i></span>
    </div>
  </el-tooltip>
</template>

<style scoped>
.lamp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  background: var(--bg-card);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  color: var(--text-secondary);
  user-select: none;
}

.led {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-disabled);
  transition: background var(--t-base) var(--ease), box-shadow var(--t-base) var(--ease);
}

.lamp-k {
  opacity: 0.6;
  letter-spacing: 0.1em;
}

.lamp-v {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  min-width: 34px;
  text-align: right;
}

.lamp-v i {
  font-style: normal;
  opacity: 0.55;
  margin-left: 1px;
}

.lamp.ok .led {
  background: var(--success);
  box-shadow: 0 0 0 0 rgb(34 197 94 / 55%);
  animation: lamp-pulse 2.6s ease-out infinite;
}

.lamp.warn .led {
  background: var(--warning);
}

@keyframes lamp-pulse {
  60% {
    box-shadow: 0 0 0 5px rgb(34 197 94 / 0%);
  }
  100% {
    box-shadow: 0 0 0 0 rgb(34 197 94 / 0%);
  }
}

@media (max-width: 1180px) {
  .lamp-k {
    display: none;
  }
}

@media (max-width: 767px) {
  .lamp {
    display: none;
  }
}
</style>
