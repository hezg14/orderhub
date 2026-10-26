import { navigationEnded, navigationStarted } from '@/composables/useRouteProgress';
import { translate } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

/**
 * `meta.titleKey` holds an i18n key, never a literal string: the document title
 * has to follow the active locale, and `afterEach` runs outside any component.
 */
declare module 'vue-router' {
  interface RouteMeta {
    auth?: boolean;
    role?: 'admin';
    layout?: 'auth';
    titleKey?: string;
  }
}

/**
 * Every view is lazily imported. The login route is in the initial chunk; the
 * business routes are fetched on navigation, which keeps the first download at
 * roughly a third of the full bundle.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { layout: 'auth', titleKey: 'auth.signIn' },
  },
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { auth: true, titleKey: 'nav.dashboard' },
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/OrderList.vue'),
        meta: { auth: true, titleKey: 'nav.orders' },
      },
      {
        path: 'orders/new',
        name: 'order-new',
        component: () => import('@/views/OrderNew.vue'),
        meta: { auth: true, titleKey: 'orderNew.title' },
      },
      {
        path: 'orders/:id',
        name: 'order-detail',
        component: () => import('@/views/OrderDetail.vue'),
        meta: { auth: true, titleKey: 'orderDetail.pageTitle' },
      },
      {
        path: 'customers',
        name: 'customers',
        component: () => import('@/views/CustomerList.vue'),
        meta: { auth: true, titleKey: 'nav.customers' },
      },
      {
        path: 'customers/:id',
        name: 'customer-detail',
        component: () => import('@/views/CustomerDetail.vue'),
        meta: { auth: true, titleKey: 'nav.customers' },
      },
      {
        path: 'products',
        name: 'products',
        component: () => import('@/views/ProductList.vue'),
        meta: { auth: true, titleKey: 'nav.products' },
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/views/Reports.vue'),
        meta: { auth: true, role: 'admin', titleKey: 'nav.reports' },
      },
      {
        path: 'audit',
        name: 'audit',
        component: () => import('@/views/Audit.vue'),
        meta: { auth: true, role: 'admin', titleKey: 'nav.audit' },
      },
      {
        path: 'permissions',
        name: 'permissions',
        component: () => import('@/views/Permissions.vue'),
        meta: { auth: true, role: 'admin', titleKey: 'nav.permissions' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/Settings.vue'),
        meta: { auth: true, titleKey: 'nav.settings' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { titleKey: 'notFound.title' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
});

router.beforeEach(async (to) => {
  navigationStarted();
  const auth = useAuthStore();

  // Resolve the session once per page load, before the first guarded navigation.
  if (!auth.bootstrapped) await auth.bootstrap();

  if (to.meta.auth && !auth.isAuthenticated) {
    return { name: 'login', query: { next: to.fullPath } };
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' };
  }

  if (to.meta.role && !auth.can(to.meta.role)) {
    // Redirect rather than render a broken page; the toast explains why.
    const { ElMessage } = await import('element-plus');
    ElMessage.warning(translate('nav.noAccess'));
    return { name: 'dashboard' };
  }

  return true;
});

router.afterEach((to) => {
  navigationEnded();
  const name = translate('common.appName');
  document.title = to.meta.titleKey ? `${translate(to.meta.titleKey)} · ${name}` : name;
});

// A lazy chunk that fails to load leaves the bar running forever otherwise.
router.onError(() => navigationEnded());
