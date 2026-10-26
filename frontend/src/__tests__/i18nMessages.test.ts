import { describe, expect, it } from 'vitest';
import en from '@/i18n/en';
import zh from '@/i18n/zh';

/**
 * The zh/en dictionaries are maintained by hand; the classic failure is adding
 * a key to one and forgetting the other, which leaks raw keys (or Chinese)
 * into the UI on a locale switch. This test fails before the UI ever can.
 */

type Dict = Record<string, unknown>;

function flatten(dict: Dict, prefix = ''): string[] {
  return Object.entries(dict).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') return flatten(value as Dict, path);
    return [path];
  });
}

describe('i18n dictionaries', () => {
  const enKeys = flatten(en as Dict).sort();
  const zhKeys = flatten(zh as Dict).sort();

  it('declare the exact same key set in both locales', () => {
    const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));
    const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
    expect(missingInZh).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('never hold an empty string as a translation', () => {
    for (const [name, dict] of [['en', en], ['zh', zh]] as const) {
      for (const path of flatten(dict as Dict)) {
        const value = path.split('.').reduce<unknown>(
          (node, key) => (node && typeof node === 'object' ? (node as Dict)[key] : undefined),
          dict,
        );
        expect(typeof value, `${name}:${path} should resolve to a string`).toBe('string');
        expect(value as string, `${name}:${path} is empty`).not.toBe('');
      }
    }
  });
});
