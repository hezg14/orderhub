import { describe, expect, it } from 'vitest';
import {
  FLOW_STEPS,
  flowFill,
  flowIndex,
  flowNodeState,
  isCancelled,
} from '@/utils/statusFlow';
import type { OrderStatus } from '@/types';

describe('statusFlow (order pipeline state machine UI)', () => {
  it('declares the 4-step pipeline in dispatch order', () => {
    expect(FLOW_STEPS).toEqual(['pending', 'paid', 'shipped', 'completed']);
  });

  it.each<[OrderStatus, number]>([
    ['pending', 0],
    ['paid', 1],
    ['shipped', 2],
    ['completed', 3],
  ])('flowIndex(%s) === %i', (status, expected) => {
    expect(flowIndex(status)).toBe(expected);
  });

  it('treats cancelled as off-track and unknown statuses as pending', () => {
    expect(isCancelled('cancelled')).toBe(true);
    expect(flowFill('cancelled')).toBe(0);
    expect(flowIndex('cancelled')).toBe(0);
    // Defensive: a status outside the list must not crash the track.
    expect(flowIndex('mystery' as OrderStatus)).toBe(0);
  });

  it('fills the rail proportionally: 0% → 25% → 50% → 75%', () => {
    expect(flowFill('pending')).toBe(0);
    expect(flowFill('paid')).toBe(25);
    expect(flowFill('shipped')).toBe(50);
    expect(flowFill('completed')).toBe(75);
  });

  it('marks nodes done/now/todo along the journey', () => {
    expect(flowNodeState('shipped', 0)).toBe('is-done');
    expect(flowNodeState('shipped', 1)).toBe('is-done');
    expect(flowNodeState('shipped', 2)).toBe('is-now');
    expect(flowNodeState('shipped', 3)).toBe('is-todo');
  });

  it('sends every node to is-dead once cancelled', () => {
    for (let step = 0; step < FLOW_STEPS.length; step += 1) {
      expect(flowNodeState('cancelled', step)).toBe('is-dead');
    }
  });

  it('never claims completion before the last step', () => {
    // Regression: a paid order must not render as "completed".
    for (const status of FLOW_STEPS.slice(0, 3) as OrderStatus[]) {
      expect(flowNodeState(status, FLOW_STEPS.length - 1)).not.toBe('is-done');
    }
    expect(flowNodeState('completed', FLOW_STEPS.length - 1)).toBe('is-now');
  });
});
