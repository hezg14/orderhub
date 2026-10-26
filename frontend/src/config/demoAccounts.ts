/**
 * Demo credentials — the single source of truth for the login prefill and the
 * in-app account switcher. These are seeded demo accounts, not secrets.
 */
export const DEMO_PASSWORD = 'Demo1234';

export interface DemoAccount {
  email: string;
  /** i18n key for the role label. */
  labelKey: 'nav.admin' | 'nav.staff';
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'admin@orderhub.demo', labelKey: 'nav.admin' },
  { email: 'staff@orderhub.demo', labelKey: 'nav.staff' },
];
