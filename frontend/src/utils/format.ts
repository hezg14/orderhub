import { currentLocale } from '@/i18n';

/**
 * Locale-aware money / number formatting shared by the dashboard pieces.
 * `currentLocale()` tracks the active language ref, so results follow locale
 * switches without extra wiring.
 */
export function fmtMoney(n: number): string {
  const locale = currentLocale() === 'zh' ? 'zh-CN' : 'en-US';
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtCompact(n: number): string {
  const locale = currentLocale() === 'zh' ? 'zh-CN' : 'en-US';
  return n.toLocaleString(locale, { maximumFractionDigits: 0 });
}
