import { authApi } from '@/api';
import { localName } from '@/i18n';
import type { User } from '@/types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const bootstrapped = ref(false);
  const loading = ref(false);

  const isAuthenticated = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.role === 'admin');
  // localName reads the locale ref, so the sidebar flips with the language.
  const displayName = computed(() => (user.value ? localName(user.value) : ''));
  const initials = computed(() => displayName.value?.slice(0, 1).toUpperCase() ?? '?');

  /**
   * Called once by the router guard. A 401 here is expected (not logged in),
   * so it must not bubble up as an error state on the login page.
   */
  async function bootstrap() {
    if (bootstrapped.value) return;
    try {
      user.value = await authApi.me();
    } catch {
      user.value = null;
    } finally {
      bootstrapped.value = true;
    }
  }

  async function login(email: string, password: string) {
    loading.value = true;
    try {
      user.value = await authApi.login(email, password);
      bootstrapped.value = true;
      return user.value;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Instant sign-out: local identity clears synchronously and the caller can
   * navigate right away; the server cookie-clear runs in the background.
   * Leaving a page must never wait on a network round trip — on a sleeping
   * free-instance deploy that round trip can take seconds, and "Sign out" is
   * the one action that has to feel instant.
   *
   * `waitForServer` exists for flows that sign a *different* account right
   * back in (account switching): that login must not race the cookie clear,
   * or the new session can be clobbered by the old logout response.
   */
  async function logout(opts: { waitForServer?: boolean } = {}) {
    user.value = null;
    bootstrapped.value = true;
    if (opts.waitForServer) {
      try {
        await authApi.logout();
      } catch {
        // Best-effort: the cookie also dies client-side and the server
        // session expires on its own.
      }
    } else {
      void authApi.logout().catch(() => {});
    }
  }

  async function updateName(name: string) {
    user.value = await authApi.updateMe(name);
  }

  /** True when the route's required role matches the signed-in role. */
  function can(required?: 'admin') {
    if (!required) return true;
    return user.value?.role === required;
  }

  return {
    user,
    bootstrapped,
    loading,
    isAuthenticated,
    isAdmin,
    displayName,
    initials,
    bootstrap,
    login,
    logout,
    updateName,
    can,
  };
});
