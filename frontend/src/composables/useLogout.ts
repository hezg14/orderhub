import { useI18n } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';

/**
 * Single logout flow: confirm → clear session → land on the login screen.
 *
 * Lives in a composable because two entry points need it (the sidebar user
 * card and the topbar avatar menu) and duplicating an async flow with a
 * confirm dialog is exactly how the two copies drift apart.
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
    router.push({ name: 'login' });
  }

  return { confirmLogout };
}
