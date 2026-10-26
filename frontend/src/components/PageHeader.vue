<script setup lang="ts">
import { useI18n } from '@/i18n';

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    backTo?: string;
  }>(),
  { description: '', backTo: '' },
);

const { t } = useI18n();
</script>

<template>
  <div class="page-header">
    <div class="left">
      <router-link v-if="backTo" :to="backTo" class="back">‹ {{ t('common.back') }}</router-link>
      <h2 class="title">{{ title }}</h2>
      <p v-if="description" class="desc">{{ description }}</p>
    </div>
    <div class="actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: var(--s-5);
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.back {
  display: inline-block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.back:hover {
  color: var(--primary);
}

.actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 767px) {
  .page-header {
    flex-direction: column;
  }

  .actions {
    margin-left: 0;
    width: 100%;
  }
}
</style>
