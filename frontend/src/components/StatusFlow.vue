<script setup lang="ts">
import { useI18n } from '@/i18n';
import type { OrderStatus } from '@/types';
import { FLOW_STEPS, flowFill, flowIndex, flowNodeState, isCancelled } from '@/utils/statusFlow';
import { computed } from 'vue';

/**
 * The order pipeline as a single horizontal run, not four badges.
 *
 * A status tag says where the record is; a track says how far it has come and
 * how much is left — which is the question a dispatcher actually has. Colour
 * carries one meaning only: solid = behind you, ringed = where you are.
 * The geometry lives in `utils/statusFlow.ts` so it stays unit-testable.
 */
const props = defineProps<{ status: OrderStatus }>();

const { t } = useI18n();

const cancelled = computed(() => isCancelled(props.status));

/** Rail spans the first to the last node — 75% of the row in a 4-column grid. */
const fill = computed(() => flowFill(props.status));

const index = computed(() => flowIndex(props.status));

function stateOf(i: number) {
  return flowNodeState(props.status, i);
}
</script>

<template>
  <div class="flow" :class="{ 'is-cancelled': cancelled }">
    <div class="rail" aria-hidden="true">
      <i class="fill" :style="{ width: `${fill}%` }" />
    </div>

    <ol class="steps">
      <li
        v-for="(step, i) in FLOW_STEPS"
        :key="step"
        class="step"
        :class="stateOf(i)"
        :aria-current="!cancelled && i === index ? 'step' : undefined"
      >
        <span class="idx mono">0{{ i + 1 }}</span>
        <span class="node"><span class="core" /></span>
        <span class="label">{{ t(`status.${step}`) }}</span>
      </li>
    </ol>

    <span v-if="cancelled" class="stamp">{{ t('status.cancelled') }}</span>
  </div>
</template>

<style scoped>
.flow {
  position: relative;
  padding: 10px 8px 4px;
}

.rail {
  position: absolute;
  top: 37px;
  left: 12.5%;
  width: 75%;
  height: 2px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  /* Animates on mount: the pipeline visibly fills to the current stage. */
  transition: width 0.65s var(--ease) 0.1s;
  box-shadow: 0 0 8px var(--primary);
}

.steps {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.idx {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--text-disabled);
  opacity: 0.75;
}

.node {
  position: relative;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  background: var(--bg-card);
  transition: border-color var(--t-base) var(--ease), background var(--t-base) var(--ease);
}

.core {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: transparent;
  transition: background var(--t-base) var(--ease);
}

.label {
  font-size: 11.5px;
  color: var(--text-disabled);
  white-space: nowrap;
}

/* Done: solid, quiet. */
.is-done .node {
  border-color: var(--primary);
  background: var(--primary);
}

.is-done .core {
  background: var(--bg-card);
}

.is-done .label {
  color: var(--text-secondary);
}

/* Now: filled plus a live ring — the only moving thing on the track. */
.is-now .node {
  border-color: var(--primary);
  background: var(--primary);
}

.is-now .node::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 1.5px solid var(--primary);
  opacity: 0.45;
  animation: node-ping 2.4s var(--ease) infinite;
}

.is-now .core {
  background: var(--bg-card);
}

.is-now .label {
  color: var(--text-primary);
  font-weight: 600;
}

.is-now .idx {
  color: var(--primary);
  opacity: 1;
}

@keyframes node-ping {
  0% {
    transform: scale(0.9);
    opacity: 0.5;
  }
  70% {
    transform: scale(1.5);
    opacity: 0;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

/* Cancelled: the track dead-ends — grey, dashed, no fill. */
.is-cancelled .rail {
  background: repeating-linear-gradient(
    90deg,
    var(--border) 0 4px,
    transparent 4px 8px
  );
}

.is-cancelled .node {
  border-color: var(--border);
  border-style: dashed;
}

.is-cancelled .fill {
  box-shadow: none;
}

.stamp {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 1px 7px;
  border: 1px solid var(--danger);
  border-radius: var(--r-pill);
  color: var(--danger);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.85;
}

@media (max-width: 640px) {
  .label {
    font-size: 10.5px;
  }

  .idx {
    display: none;
  }

  .rail {
    top: 18px;
  }
}
</style>
