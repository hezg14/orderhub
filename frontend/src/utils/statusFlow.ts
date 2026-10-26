import type { OrderStatus } from '@/types';

/**
 * Order-pipeline geometry — extracted from StatusFlow.vue so the state machine
 * can be unit tested without mounting a component.
 *
 * A status tag says where the record is; a track says how far it has come and
 * how much is left — which is the question a dispatcher actually has. Colour
 * carries one meaning only: solid = behind you, ringed = where you are.
 */
export const FLOW_STEPS: OrderStatus[] = ['pending', 'paid', 'shipped', 'completed'];

export function isCancelled(status: OrderStatus): boolean {
  return status === 'cancelled';
}

/** Position on the pipeline; unknown statuses (defensive) count as pending. */
export function flowIndex(status: OrderStatus): number {
  const at = FLOW_STEPS.indexOf(status);
  return at < 0 ? 0 : at;
}

/** Rail width in % — spans the first to the last node (75% of a 4-col row). */
export function flowFill(status: OrderStatus): number {
  if (isCancelled(status)) return 0;
  return (flowIndex(status) / (FLOW_STEPS.length - 1)) * 75;
}

export type FlowNodeState = 'is-done' | 'is-now' | 'is-todo' | 'is-dead';

export function flowNodeState(status: OrderStatus, step: number): FlowNodeState {
  if (isCancelled(status)) return 'is-dead';
  const index = flowIndex(status);
  if (step < index) return 'is-done';
  if (step === index) return 'is-now';
  return 'is-todo';
}
