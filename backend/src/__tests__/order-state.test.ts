import { describe, expect, it } from 'vitest';
import { AppError } from '../lib/errors';
import {
  canCancel,
  canTransition,
  STATUS_LABEL,
  TRANSITIONS,
  assertTransition,
} from '../lib/order-state';

describe('order state machine', () => {
  it('permits the happy path pending → paid → shipped → completed', () => {
    expect(canTransition('pending', 'paid')).toBe(true);
    expect(canTransition('paid', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'completed')).toBe(true);
  });

  it('allows cancelling a pending order only', () => {
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('paid', 'cancelled')).toBe(false);
    expect(canTransition('shipped', 'cancelled')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
  });

  it('never moves backwards', () => {
    expect(canTransition('paid', 'pending')).toBe(false);
    expect(canTransition('shipped', 'paid')).toBe(false);
    expect(canTransition('completed', 'shipped')).toBe(false);
  });

  it('skips are rejected (created → picked_up has no shortcut)', () => {
    expect(canTransition('pending', 'shipped')).toBe(false);
    expect(canTransition('pending', 'completed')).toBe(false);
  });

  it('treats completed and cancelled as terminal', () => {
    for (const target of Object.keys(TRANSITIONS) as (keyof typeof TRANSITIONS)[]) {
      expect(canTransition('completed', target)).toBe(false);
      expect(canTransition('cancelled', target)).toBe(false);
    }
  });

  it('throws a 422 with the allowed next states attached', () => {
    try {
      assertTransition('completed', 'cancelled');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const apiError = err as AppError;
      expect(apiError.status).toBe(422);
      expect(apiError.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(apiError.details).toMatchObject({
        current: 'completed',
        requested: 'cancelled',
        allowedNext: [],
      });
    }
  });

  it('explains what is allowed when a move is rejected', () => {
    try {
      assertTransition('pending', 'completed');
    } catch (err) {
      const details = (err as AppError).details as { hint: string };
      expect(details.hint).toContain('待付款');
      expect(details.hint).toContain('已付款');
    }
  });

  it('has a label for every state', () => {
    for (const state of Object.keys(TRANSITIONS)) {
      expect(STATUS_LABEL[state as keyof typeof STATUS_LABEL]).toBeTruthy();
    }
  });

  it('grants cancel to admins only', () => {
    expect(canCancel('admin')).toBe(true);
    expect(canCancel('staff')).toBe(false);
  });
});
