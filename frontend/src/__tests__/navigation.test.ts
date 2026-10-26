import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, activeNavPath, navFor } from '@/config/navigation';

describe('navFor (role filtering)', () => {
  it('hides admin-only pages from staff', () => {
    const staffPaths = navFor(false).map((n) => n.path);
    expect(staffPaths).not.toContain('/reports');
    expect(staffPaths).not.toContain('/audit');
    expect(staffPaths).not.toContain('/permissions');
  });

  it('gives admins the full list', () => {
    expect(navFor(true)).toEqual(NAV_ITEMS);
    expect(navFor(true).map((n) => n.path)).toContain('/permissions');
  });

  it('never filters shared pages away from staff', () => {
    const staffPaths = navFor(false).map((n) => n.path);
    for (const p of ['/', '/orders', '/customers', '/products', '/settings']) {
      expect(staffPaths).toContain(p);
    }
  });
});

describe('activeNavPath (sidebar highlight)', () => {
  it('highlights the dashboard only for the exact root path', () => {
    expect(activeNavPath('/', true)).toBe('/');
    // Without `exact`, '/' would swallow every route as a prefix match.
    expect(activeNavPath('/orders', true)).not.toBe('/');
  });

  it('matches detail routes by prefix', () => {
    expect(activeNavPath('/orders/o-123', true)).toBe('/orders');
    expect(activeNavPath('/customers/c-9', true)).toBe('/customers');
  });

  it('falls back to the dashboard for unknown paths', () => {
    expect(activeNavPath('/nowhere', true)).toBe('/');
  });

  it('ignores admin items when resolving for staff', () => {
    // A staff member deep-linking an admin page gets no admin highlight.
    expect(activeNavPath('/reports', false)).toBe('/');
  });
});
