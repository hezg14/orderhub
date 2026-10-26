<script setup lang="ts">
import { ApiError } from '@/api/client';
import { useLogout } from '@/composables/useLogout';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/config/demoAccounts';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { Setting, Switch, SwitchButton } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

/**
 * The account menu, shared by the sidebar user card and the topbar avatar.
 *
 * Important: the trigger must be the *default slot's DOM element* — wrapping
 * it in `el-tooltip` breaks `el-dropdown`'s trigger ref, and the menu silently
 * never opens. Use the native `title` attribute for the hint instead.
 */
withDefaults(defineProps<{ placement?: 'top-start' | 'top' | 'bottom-end' }>(), {
  placement: 'bottom-end',
});

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const { confirmLogout } = useLogout();

const switching = ref(false);

/** Every seeded demo account other than the signed-in one. */
const otherAccounts = computed(() => DEMO_ACCOUNTS.filter((a) => a.email !== auth.user?.email));

/**
 * Switching identity reloads the page on purpose: role-driven menus, cached
 * lists and store state must rebuild against the new user.
 */
async function switchAccount(email: string) {
  if (switching.value) return;
  switching.value = true;
  try {
    await auth.logout();
    await auth.login(email, DEMO_PASSWORD);
    ElMessage.success(t('nav.switched', { name: auth.displayName }));
    window.location.assign('/');
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('nav.switchFailed'));
    window.location.assign('/login');
  } finally {
    switching.value = false;
  }
}

function onCommand(command: string | number | object) {
  const cmd = String(command);
  if (cmd === 'logout') return confirmLogout();
  if (cmd === 'settings') return router.push('/settings');
  if (cmd.startsWith('switch:')) return switchAccount(cmd.slice(7));
}
</script>

<template>
  <el-dropdown trigger="click" :placement="placement" @command="onCommand">
    <slot />
    <template #dropdown>
      <el-dropdown-menu class="account-menu">
        <li class="acct-head">
          <span class="acct-name">{{ auth.displayName }}</span>
          <span class="acct-mail">{{ auth.user?.email }}</span>
          <span class="acct-role">{{ t(auth.isAdmin ? 'nav.admin' : 'nav.staff') }}</span>
        </li>

        <el-dropdown-item command="settings" :icon="Setting">
          {{ t('nav.profile') }}
        </el-dropdown-item>

        <template v-if="otherAccounts.length">
          <li class="acct-label">{{ t('nav.switchUser') }}</li>
          <el-dropdown-item
            v-for="acct in otherAccounts"
            :key="acct.email"
            :command="`switch:${acct.email}`"
            :icon="Switch"
          >
            {{ t('nav.switchTo', { role: t(acct.labelKey) }) }}
          </el-dropdown-item>
        </template>

        <el-dropdown-item command="logout" divided class="acct-logout" :icon="SwitchButton">
          {{ t('nav.logout') }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.acct-head {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 10px 14px 9px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
  min-width: 210px;
  list-style: none;
}

.acct-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.acct-mail {
  font-size: 11px;
  color: var(--text-disabled);
}

.acct-role {
  margin-top: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--primary);
}

.acct-label {
  padding: 8px 14px 3px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-disabled);
  list-style: none;
}

/* Destructive action stays visually distinct at the bottom of the menu. */
.acct-logout {
  color: var(--danger) !important;
}
</style>
