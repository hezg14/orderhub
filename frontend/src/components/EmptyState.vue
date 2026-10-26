<script setup lang="ts">
import { useI18n } from '@/i18n';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    compact?: boolean;
  }>(),
  // Defaults come from i18n so an unconfigured empty state follows the locale.
  { title: undefined, description: undefined, compact: false },
);

const { t } = useI18n();
const resolvedTitle = computed(() => props.title ?? t('empty.title'));
const resolvedDescription = computed(() => props.description ?? t('empty.description'));
</script>

<template>
  <div class="empty" :class="{ compact }">
    <svg width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden="true">
      <!-- Brand motif: a parcel travelling a route, instead of a generic sheet.
           Marching dashes keep the empty state alive without being noisy. -->
      <path
        d="M10 60C24 42 38 62 50 46s18-24 34-30"
        stroke="var(--primary-border)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-dasharray="2 7"
        class="route-dash"
      />
      <circle cx="10" cy="60" r="3.2" fill="var(--primary)" opacity="0.45" />
      <circle cx="86" cy="14" r="3.2" fill="var(--primary)" opacity="0.45" />
      <rect x="39" y="27" width="20" height="17" rx="4.5" fill="var(--primary-bg)" stroke="var(--primary-border)" />
      <path d="M39 33h20M49 33v11" stroke="var(--primary-border)" stroke-width="1.4" />
      <circle cx="49" cy="25" r="2.6" fill="var(--primary)" />
    </svg>
    <p class="t">{{ resolvedTitle }}</p>
    <p class="d">{{ resolvedDescription }}</p>
    <div class="a"><slot /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 56px 24px;
  text-align: center;
}

.route-dash {
  animation: dash-march 1.8s linear infinite;
}

@keyframes dash-march {
  to {
    stroke-dashoffset: -18;
  }
}

.empty.compact {
  padding: 28px 16px;
}

.t {
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 500;
}

.d {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 320px;
}

.a {
  margin-top: 12px;
}
</style>
