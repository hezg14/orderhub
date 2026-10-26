import { describe, expect, it } from 'vitest';
import { PERMISSION_MATRIX } from '@/config/permissions';

describe('PERMISSION_MATRIX', () => {
  it('has unique row keys', () => {
    const keys = PERMISSION_MATRIX.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never grants staff something admin lacks', () => {
    for (const row of PERMISSION_MATRIX) {
      if (row.staff) expect(row.admin).toBe(true);
    }
  });

  it('keeps the known admin-only divisions staff-proof', () => {
    const staffAllowed = new Set(PERMISSION_MATRIX.filter((r) => r.staff).map((r) => r.key));
    for (const key of ['ordersCancel', 'ordersDelete', 'productsWrite', 'reports', 'audit', 'members']) {
      expect(staffAllowed.has(key)).toBe(false);
    }
  });

  it('keeps every row documented with a note when roles differ', () => {
    for (const row of PERMISSION_MATRIX) {
      if (row.admin !== row.staff) {
        // A differing row without a noteKey would render unexplained on /permissions.
        expect(row.noteKey).toBeDefined();
      }
    }
  });
});
