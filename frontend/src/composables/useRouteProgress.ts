import { ref } from 'vue';

/**
 * Router navigation state, surfaced as a thin progress bar at the top of the
 * shell. Lazy route chunks mean a navigation can take 100–400 ms with zero
 * visual feedback otherwise — that silence is what makes an app feel slow.
 */
export const navigating = ref(false);

let hideTimer: number | undefined;

/**
 * Idempotent by design: a guard that redirects fires `beforeEach` twice, so a
 * counter would leak. A boolean plus a short off-delay cannot get stuck.
 */
export function navigationStarted() {
  if (hideTimer) window.clearTimeout(hideTimer);
  navigating.value = true;
}

export function navigationEnded() {
  if (hideTimer) window.clearTimeout(hideTimer);
  // Hold briefly so a fast navigation still registers as motion.
  hideTimer = window.setTimeout(() => (navigating.value = false), 220);
}
