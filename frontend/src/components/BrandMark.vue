<script setup lang="ts">
/**
 * The OrderHub brand mark: a route line flowing from one node to another —
 * an order's journey. This is the single graphic motif repeated across every
 * touchpoint (sidebar logo, login, boot screen, empty states, loader).
 *
 * Gradient stops mirror --brand-gradient in tokens.css; SVG gradients cannot
 * read CSS variables, so the values live here as brand constants.
 */
withDefaults(defineProps<{ size?: number; tile?: boolean; animated?: boolean }>(), {
  size: 32,
  tile: true,
  animated: false,
});

// Unique gradient id per instance — several marks can coexist on one page.
const uid = Math.random().toString(36).slice(2, 8);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    class="brand-mark-svg"
    :class="{ animated }"
  >
    <defs>
      <linearGradient :id="`bmg-${uid}`" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4f46e5" />
        <stop offset="0.55" stop-color="#7c3aed" />
        <stop offset="1" stop-color="#a855f7" />
      </linearGradient>
    </defs>

    <rect v-if="tile" x="1" y="1" width="30" height="30" rx="9" :fill="`url(#bmg-${uid})`" />

    <path
      d="M9 23c0-6 14-2 14-12"
      :stroke="tile ? '#ffffff' : `url(#bmg-${uid})`"
      stroke-width="2.6"
      stroke-linecap="round"
      pathLength="100"
      class="route"
    />
    <circle cx="9" cy="23" r="2.7" :fill="tile ? '#ffffff' : `url(#bmg-${uid})`" />
    <circle
      cx="16.4"
      cy="16.4"
      r="2"
      :stroke="tile ? '#ffffff' : `url(#bmg-${uid})`"
      stroke-width="1.7"
      :fill="tile ? 'transparent' : 'none'"
    />
    <circle cx="23" cy="11" r="2.7" :fill="tile ? '#ffffff' : `url(#bmg-${uid})`" />

    <template v-if="animated">
      <circle r="2.1" :fill="tile ? '#ffffff' : '#a855f7'">
        <animateMotion dur="1.6s" repeatCount="indefinite" path="M9 23c0-6 14-2 14-12" />
      </circle>
    </template>
  </svg>
</template>

<style scoped>
.brand-mark-svg.animated .route {
  stroke-dasharray: 100;
  animation: route-dash 2.2s var(--ease, ease) infinite;
}

@keyframes route-dash {
  0% {
    stroke-dashoffset: 100;
  }
  55%,
  100% {
    stroke-dashoffset: 0;
  }
}
</style>
