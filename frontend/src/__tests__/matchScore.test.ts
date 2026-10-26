import { describe, expect, it } from 'vitest';
import { bestMatchScore, matchScore } from '@/utils/matchScore';

describe('matchScore', () => {
  it('ranks prefix above substring above subsequence', () => {
    const prefix = matchScore('ord', 'Order list');
    const substring = matchScore('list', 'Order list');
    const subsequence = matchScore('orlst', 'Order list');
    expect(prefix).toBe(1000);
    expect(substring).toBeGreaterThan(0);
    expect(substring).toBeLessThan(1000);
    expect(subsequence).toBeGreaterThan(0);
    expect(subsequence).toBeLessThan(substring);
  });

  it('matches case-insensitively', () => {
    expect(matchScore('ORDER', 'order list')).toBe(1000);
    expect(matchScore('order', 'ORDER LIST')).toBe(1000);
  });

  it('lets expert abbreviations find their target ("orlst" → "Order list")', () => {
    expect(matchScore('orlst', 'Order list')).toBeGreaterThan(0);
    expect(matchScore('prdct', 'Products')).toBeGreaterThan(0);
  });

  it('rewards consecutive characters and early hits', () => {
    const streak = matchScore('ord', 'Order list');
    const scattered = matchScore('o r d', 'Order list'.replace(/ /g, ''));
    // "ord" as a prefix must beat the same three letters spread out.
    expect(streak).toBeGreaterThan(scattered);
    const early = matchScore('d', 'dashboard');
    const late = matchScore('d', 'products');
    expect(early).toBeGreaterThan(late);
  });

  it('returns -1 when a character is missing entirely', () => {
    expect(matchScore('zzz', 'Order list')).toBe(-1);
    expect(matchScore('orderz', 'Order list')).toBe(-1);
  });

  it('returns 0 for an empty needle (no query = unranked list)', () => {
    expect(matchScore('', 'anything')).toBe(0);
  });

  it('substring score decays the deeper the hit sits', () => {
    const early = matchScore('r', 'order');
    const late = matchScore('s', 'products');
    expect(early).toBeGreaterThan(late);
  });
});

describe('bestMatchScore', () => {
  it('takes the best field, so a keyword hit surfaces a labelled item', () => {
    // Label doesn't match; the Chinese keyword does (as a substring).
    const best = bestMatchScore('库存', {
      label: 'Products',
      keywords: 'product sku stock 商品 库存',
      meta: '/products',
    });
    expect(best).toBeGreaterThan(0);
    expect(best).toBeGreaterThanOrEqual(600);
  });

  it('returns -1 when no field matches', () => {
    expect(
      bestMatchScore('zzz', { label: 'Orders', keywords: 'order sales', meta: '/orders' }),
    ).toBe(-1);
  });

  it('tolerates missing keywords and meta', () => {
    expect(bestMatchScore('ord', { label: 'Orders' })).toBe(1000);
  });
});
