<template>
  <div class="nf">
    <div class="code mono">404</div>
    <h1>{{ t('notFound.title') }}</h1>
    <p>{{ t('notFound.subtitle') }}</p>
    <router-link to="/">
      <el-button type="primary">{{ t('notFound.backHome') }}</el-button>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n';

const { t } = useI18n();
</script>

<style scoped>
.nf {
  min-height: 100vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  text-align: center;
  background: var(--bg-page);
}

.code {
  font-size: 72px;
  font-weight: 700;
  color: var(--border);
  line-height: 1;
  letter-spacing: -0.04em;
}

h1 {
  margin: 8px 0 0;
  font-size: 20px;
}

p {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
