<script setup lang="ts">
import { useI18n } from '@/i18n';
import en from 'element-plus/es/locale/lang/en';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import SignOutOverlay from '@/components/SignOutOverlay.vue';
import { computed } from 'vue';

const { locale } = useI18n();

/** Element Plus ships its own locale packs; keep them in step with ours. */
const elementLocale = computed(() => (locale.value === 'zh' ? zhCn : en));
</script>

<template>
  <el-config-provider :locale="elementLocale" :button="{ autoInsertSpace: false }">
    <router-view v-slot="{ Component, route }">
      <!-- Keyed by path so a detail page never reuses the previous record's state. -->
      <component :is="Component" :key="route.path" />
    </router-view>
    <!-- Lives here, outside the router: the shutdown overlay must survive the
         redirect from an authenticated page to /login. -->
    <SignOutOverlay />
  </el-config-provider>
</template>
