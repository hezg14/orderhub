import { afterEach, describe, expect, it } from 'vitest';
import { fmtCompact, fmtMoney } from '@/utils/format';
import { setLocale } from '@/i18n';

describe('format helpers (locale-aware)', () => {
  afterEach(() => setLocale('en'));

  it('renders money with thousands separators and exactly 2 decimals', () => {
    setLocale('en');
    expect(fmtMoney(1234.5)).toBe('1,234.50');
    expect(fmtMoney(0)).toBe('0.00');
    expect(fmtMoney(1234567.891)).toBe('1,234,567.89');
  });

  it('renders compact numbers without decimals', () => {
    setLocale('en');
    expect(fmtCompact(1234567)).toBe('1,234,567');
    expect(fmtCompact(42)).toBe('42');
  });

  it('follows locale switches (zh-CN formatting)', () => {
    setLocale('zh');
    expect(fmtMoney(1234.5)).toBe('1,234.50');
    expect(fmtCompact(1234567)).toBe('1,234,567');
  });
});
