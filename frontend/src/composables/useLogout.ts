import { useI18n } from '@/i18n';
import { SIGN_OUT_BEAT_MS, signingOut } from '@/composables/signOutTransition';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';

/**
 * Single logout flow: confirm → shutdown beat → land on the login screen.
 *
 * Lives in a composable because multiple entry points need it (the topbar
 * avatar menu and the command palette) and duplicating an async flow with a
 * confirm dialog is exactly how the two copies drift apart.
 *
 * The session clear itself is instant (stores/auth.ts runs the server call in
 * the background); the overlay adds a short, deliberate "power down" beat so
 * the hand-off to the login screen reads as choreography, not lag.
 */
export function useLogout() {
  const { t } = useI18n();
  const auth = useAuthStore();
  const router = useRouter();

  async function confirmLogout() {
    try {
      await ElMessageBox.confirm(t('nav.logoutConfirm'), t('nav.logoutTitle'), {
        confirmButtonText: t('nav.logout'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      });
    } catch {
      // Dismissed — cancelling is not an error.
      return;
    }

    await auth.logout();
    signingOut.value = true;
    await new Promise((resolve) => setTimeout(resolve, SIGN_OUT_BEAT_MS));
    await router.push({ name: 'login' });
    // Let the overlay's leave transition finish over the login screen.
    setTimeout(() => {
      signingOut.value = false;
    }, 350);
  }

  return { confirmLogout };
}
