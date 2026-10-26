import { computed, ref } from 'vue';
import en from './en';
import zh from './zh';

export const SUPPORTED_LOCALES = ['en', 'zh'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = 'orderhub.locale';

type Dict = Record<string, unknown>;
const MESSAGES: Record<AppLocale, Dict> = { en, zh };

/**
 * English is the default on purpose: the demo is shown to an English-speaking
 * audience, so an empty localStorage must not fall back to Chinese.
 */
function detectLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'zh' || saved === 'en' ? saved : 'en';
}

export const locale = ref<AppLocale>(detectLocale());

document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en';

function lookup(dict: Dict, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>(
    (node, key) => (node && typeof node === 'object' ? (node as Dict)[key] : undefined),
    dict,
  );
  return typeof value === 'string' ? value : undefined;
}

/**
 * `t('orders.count', { n: 12 })` → "12 orders".
 *
 * Reading `locale.value` here is what makes templates re-render on a switch:
 * the call happens during render, so Vue registers the dependency for us.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = lookup(MESSAGES[locale.value], key) ?? lookup(MESSAGES.en, key);

  // A missing key is a bug: show it in dev, degrade gracefully in prod.
  if (template === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }

  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function currentLocale(): AppLocale {
  return locale.value;
}

export function setLocale(next: AppLocale) {
  locale.value = next;
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
}

/** Translation outside a component (router guards, module scope). */
export const translate = t;

/**
 * Data-level localisation: demo records carry both a Chinese name (the source
 * of truth) and an optional English translation. Reading `locale.value` makes
 * any template that calls this re-render on a language switch.
 */
export interface LocalizedName {
  name: string;
  nameEn?: string | null;
}

export function localName<T extends LocalizedName>(record: T): string {
  return locale.value === 'zh' ? record.name : (record.nameEn ?? record.name);
}

export interface LocalizedCompany {
  company?: string | null;
  companyEn?: string | null;
}

export function localCompany(record: LocalizedCompany): string {
  if (locale.value === 'zh') return record.company ?? '';
  return record.companyEn ?? record.company ?? '';
}

/** Categories are stored as Chinese labels; English UI maps them. */
const CATEGORY_EN: Record<string, string> = {
  办公用品: 'Office Supplies',
  家居日用: 'Home & Living',
  食品饮料: 'Food & Beverage',
  电子配件: 'Electronics & Accessories',
};

export function localCategory(category: string): string {
  if (locale.value === 'zh') return category;
  return CATEGORY_EN[category] ?? category;
}

/**
 * Mirrors the shape of `vue-i18n`'s composable so the call sites read the same.
 * Swapping to the real library later is a one-import change per component.
 */
export function useI18n() {
  return {
    t,
    locale,
    /** Reactive locale code, for `Intl` formatting. */
    localeCode: computed(() => (locale.value === 'zh' ? 'zh-CN' : 'en-US')),
  };
}
