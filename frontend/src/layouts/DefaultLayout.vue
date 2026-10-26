<script setup lang="ts">
import { currentLocale, setLocale, useI18n, type AppLocale } from '@/i18n';
import { useTheme } from '@/composables/useTheme';
import { useCommandPalette } from '@/composables/useCommandPalette';
import { navigating } from '@/composables/useRouteProgress';
import { activeNavPath, navFor } from '@/config/navigation';
import { useAuthStore } from '@/stores/auth';
import AccountMenu from '@/components/AccountMenu.vue';
import BrandMark from '@/components/BrandMark.vue';
import CommandPalette from '@/components/CommandPalette.vue';
import SystemPulse from '@/components/SystemPulse.vue';
import {
  ArrowDown,
  Fold,
  Moon,
  Search,
  Sunny,
} from '@element-plus/icons-vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const { t, locale } = useI18n();
const { theme, toggle: toggleTheme } = useTheme();
const { show: showPalette } = useCommandPalette();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const mobileOpen = ref(false);
const isMobile = ref(false);

/** The cap has to name the key the user actually has. */
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Nav comes from the shared model — the palette reads the same list. */
const menu = computed(() => navFor(auth.isAdmin));

const activePath = computed(() => activeNavPath(route.path, auth.isAdmin));

const pageTitle = computed(() => (route.meta.titleKey ? t(route.meta.titleKey) : t('common.appName')));

const LOCALES: { value: AppLocale; labelKey: string }[] = [
  { value: 'en', labelKey: 'common.english' },
  { value: 'zh', labelKey: 'common.chinese' },
];

function changeLocale(next: string) {
  setLocale(next as AppLocale);
}

/** The document title lives outside the render tree, so keep it in step. */
watch(locale, () => {
  document.title = `${pageTitle.value} · ${t('common.appName')}`;
});

const today = computed(() =>
  new Date().toLocaleDateString(currentLocale() === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }),
);

function onResize() {
  isMobile.value = window.innerWidth < 768;
  if (!isMobile.value) mobileOpen.value = false;
}

onMounted(() => {
  onResize();
  window.addEventListener('resize', onResize, { passive: true });
});
onBeforeUnmount(() => window.removeEventListener('resize', onResize));

function go(path: string) {
  router.push(path);
  mobileOpen.value = false;
}
</script>

<template>
  <div class="shell">
    <!-- Navigation progress: a 2px travelling highlight at the top edge. -->
    <div class="route-bar" :class="{ on: navigating }" aria-hidden="true" />

    <!-- Overlay only exists on small screens -->
    <div v-if="isMobile && mobileOpen" class="scrim" @click="mobileOpen = false" />

    <aside class="sidebar" :class="{ 'is-open': mobileOpen }">
      <div class="brand">
        <BrandMark :size="34" />
        <div>
          <div class="brand-name">{{ t('common.appName') }}</div>
          <div class="brand-sub">{{ t('common.tagline') }}</div>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in menu"
          :key="item.path"
          class="nav-item"
          :class="{ active: activePath === item.path }"
          type="button"
          @click="go(item.path)"
        >
          <el-icon :size="18"><component :is="item.icon" /></el-icon>
          <span>{{ t(item.labelKey) }}</span>
        </button>
      </nav>

      <!-- Identity only. The account menu lives in the topbar — one entry point,
           not two competing ones. -->
      <div class="sidebar-foot">
        <div class="avatar">{{ auth.initials }}</div>
        <div class="who">
          <div class="who-name">{{ auth.displayName }}</div>
          <div class="who-role">{{ t(auth.isAdmin ? 'nav.admin' : 'nav.staff') }}</div>
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button
          v-if="isMobile"
          class="icon-btn"
          type="button"
          :aria-label="t('nav.openMenu')"
          @click="mobileOpen = true"
        >
          <el-icon :size="20"><Fold /></el-icon>
        </button>
        <h1 class="page-title">{{ pageTitle }}</h1>

        <div class="topbar-right">
          <!-- Keyboard-first entry point: the single most "operated console"
               affordance in the product. -->
          <button
            class="cmd-trigger"
            type="button"
            :aria-label="t('common.searchOrJump')"
            @click="showPalette"
          >
            <el-icon :size="13"><Search /></el-icon>
            <span class="cmd-label">{{ t('common.searchOrJump') }}</span>
            <kbd class="kbd cmd-kbd">{{ isMac ? '⌘K' : 'Ctrl K' }}</kbd>
          </button>

          <SystemPulse />

          <span class="topbar-div" />

          <span v-if="!auth.isAdmin" class="role-chip">{{ t('nav.staffView') }}</span>

          <el-tooltip :content="t('common.toggleTheme')" placement="bottom">
            <button
              class="icon-btn theme-btn"
              type="button"
              :aria-label="t('common.toggleTheme')"
              @click="toggleTheme"
            >
              <el-icon :size="16">
                <Moon v-if="theme === 'light'" />
                <Sunny v-else />
              </el-icon>
            </button>
          </el-tooltip>

          <el-dropdown trigger="click" @command="changeLocale">
            <!-- No el-tooltip wrapper here: it swallows el-dropdown's trigger ref. -->
            <button
              class="lang-btn"
              type="button"
              :title="t('common.language')"
              :aria-label="t('common.language')"
            >
              {{ currentLocale() === 'zh' ? '中文' : 'EN' }}
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="l in LOCALES"
                  :key="l.value"
                  :command="l.value"
                  :disabled="locale === l.value"
                >
                  {{ t(l.labelKey) }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <span class="today">{{ today }}</span>

          <AccountMenu placement="bottom-end">
            <button class="user-chip" type="button" :title="t('nav.accountMenu')">
              <span class="chip-avatar">{{ auth.initials }}</span>
              <span class="chip-name">{{ auth.displayName }}</span>
              <el-icon :size="11"><ArrowDown /></el-icon>
            </button>
          </AccountMenu>
        </div>
      </header>

      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <CommandPalette />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-page);
}

.scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  z-index: 40;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-w);
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.brand {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  border-bottom: 1px solid var(--sidebar-border);
}

/* The gradient mark is the brand's signature — repeated on the login page. */

.brand-name {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.2;
  color: var(--sidebar-fg-strong);
}

.brand-sub {
  font-size: 11px;
  color: var(--sidebar-fg);
  opacity: 0.62;
}

.nav {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  border-radius: var(--r-control);
  background: transparent;
  color: var(--sidebar-fg);
  font-size: 13.5px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}

.nav-item:hover {
  background: var(--sidebar-hover);
  color: var(--sidebar-fg-strong);
}

/* Active item: lifted surface plus a solid 2px rail. Solid, not gradient —
   color here means "you are here", nothing more. */
.nav-item.active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-fg);
  font-weight: 500;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--sidebar-active-fg);
}

.nav-item:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

.sidebar-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-top: 1px solid var(--sidebar-border);
}

.avatar {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--primary-solid);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 600;
}

.who {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.who-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--sidebar-fg-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.who-role {
  font-size: 11px;
  color: var(--sidebar-fg);
  opacity: 0.62;
}

/* Topbar avatar chip — the second, always-visible account entry point. */
.user-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 8px 4px 4px;
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}

.user-chip:hover {
  border-color: var(--primary-border);
  color: var(--text-primary);
}

.chip-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-solid);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 600;
}

.chip-name {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main {
  flex: 1;
  min-width: 0;
  margin-left: var(--sidebar-w);
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  background: var(--topbar-bg);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

/* Section indicator, not a repeated page title — the page carries its own H2. */
.page-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 0;
}

.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
  color: var(--text-secondary);
}

.role-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: var(--r-pill);
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--border);
}

.icon-btn {
  border: 1px solid var(--border);
  background: var(--bg-card);
  border-radius: var(--r-control);
  padding: 6px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.lang-btn {
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: var(--r-pill);
  padding: 4px 10px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
}

.lang-btn:hover {
  border-color: var(--primary-border);
  color: var(--primary);
}

.content {
  flex: 1;
  min-height: 0;
}

/* Page swap: a short rise instead of a bare cross-fade — enough motion to read
   as a transition, not enough to make you wait. */
.page-enter-active {
  transition: opacity 0.18s var(--ease), transform 0.22s var(--ease);
}

.page-leave-active {
  transition: opacity 0.1s var(--ease);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-leave-to {
  opacity: 0;
}

/* ---------------------------------------------------- navigation progress */

.route-bar {
  position: fixed;
  top: 0;
  left: var(--sidebar-w);
  right: 0;
  height: 2px;
  z-index: 60;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s var(--ease);
}

.route-bar.on {
  opacity: 1;
}

.route-bar::after {
  content: '';
  display: block;
  width: 38%;
  height: 100%;
  border-radius: 0 2px 2px 0;
  background: var(--primary);
  box-shadow: 0 0 10px var(--primary);
  animation: route-sweep 0.95s var(--ease) infinite;
}

@keyframes route-sweep {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(320%);
  }
}

/* ------------------------------------------------------------- cmd trigger */

.cmd-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 6px 0 9px;
  border: 1px solid var(--border);
  border-radius: var(--r-control);
  background: var(--bg-card);
  color: var(--text-disabled);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}

.cmd-trigger:hover {
  border-color: var(--primary-border);
  color: var(--text-secondary);
}

.cmd-label {
  white-space: nowrap;
}

.cmd-kbd {
  margin-left: 4px;
}

.topbar-div {
  width: 1px;
  height: 18px;
  background: var(--border);
}

@media (max-width: 1180px) {
  /* The topbar is a budget: drop the date before it crowds the avatar. */
  .today {
    display: none;
  }
}

@media (max-width: 1023px) {
  .cmd-label {
    display: none;
  }

  .cmd-kbd {
    display: none;
  }

  .cmd-trigger {
    width: 28px;
    padding: 0;
    justify-content: center;
  }

  .topbar-div {
    display: none;
  }

  .route-bar {
    left: 64px;
  }
}

@media (max-width: 1023px) {
  .sidebar {
    width: 64px;
  }

  .brand > div:last-child,
  .nav-item span,
  .who {
    display: none;
  }

  .sidebar-foot {
    justify-content: center;
    padding: 13px 0;
  }

  .nav-item {
    justify-content: center;
    padding: 10px;
  }

  .main {
    margin-left: 64px;
  }
}

@media (max-width: 767px) {
  .sidebar {
    width: var(--sidebar-w);
    transform: translateX(-100%);
    transition: transform var(--t-base) var(--ease);
  }

  .sidebar.is-open {
    transform: none;
  }

  .brand > div:last-child,
  .nav-item span,
  .who {
    display: block;
  }

  .who {
    display: flex;
  }

  .sidebar-foot {
    justify-content: flex-start;
    padding: 13px 16px;
  }

  .nav-item {
    justify-content: flex-start;
    padding: 10px 12px;
  }

  .main {
    margin-left: 0;
  }

  .topbar {
    padding: 0 16px;
  }

  .chip-name {
    display: none;
  }

  .route-bar {
    left: 0;
  }
}
</style>
