<script setup lang="ts">
/**
 * Brand loading animation — a parcel dot travelling along the same route
 * motif as the logo. Used wherever a spinner would be generic (boot screen,
 * long exports). ToB differentiation through motion: the loading state itself
 * carries the brand, not just a spinner shape.
 */
withDefaults(defineProps<{ width?: number }>(), { width: 180 });
</script>

<template>
  <svg
    :width="width"
    :height="44"
    viewBox="0 0 180 44"
    fill="none"
    aria-hidden="true"
    class="route-loader"
  >
    <defs>
      <linearGradient id="rlg" x1="8" y1="36" x2="172" y2="8" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4f46e5" />
        <stop offset="0.55" stop-color="#7c3aed" />
        <stop offset="1" stop-color="#a855f7" />
      </linearGradient>
    </defs>

    <path
      d="M10 34C48 34 42 12 90 12s44 22 80 6"
      stroke="var(--border, #e4e7f0)"
      stroke-width="2"
      stroke-linecap="round"
      stroke-dasharray="1 8"
    />
    <path
      d="M10 34C48 34 42 12 90 12s44 22 80 6"
      stroke="url(#rlg)"
      stroke-width="2.4"
      stroke-linecap="round"
      pathLength="100"
      class="progress"
    />
    <circle cx="10" cy="34" r="3.4" fill="url(#rlg)" opacity="0.45" />
    <circle cx="170" cy="18" r="3.4" fill="url(#rlg)" opacity="0.45" />
    <circle r="4.6" fill="url(#rlg)">
      <animateMotion dur="1.8s" repeatCount="indefinite" path="M10 34C48 34 42 12 90 12s44 22 80 6" />
    </circle>
  </svg>
</template>

<style scoped>
.progress {
  stroke-dasharray: 100;
  animation: rl-draw 1.8s linear infinite;
}

@keyframes rl-draw {
  0% {
    stroke-dashoffset: 100;
  }
  70%,
  100% {
    stroke-dashoffset: 0;
  }
}
</style>
