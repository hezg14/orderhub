import { ref } from 'vue';

/**
 * Shared state for the sign-out shutdown overlay.
 *
 * Module-scoped on purpose: the overlay is mounted once in App.vue (so it
 * survives the route change to /login), while its trigger lives in useLogout
 * deep inside the layout. A shared ref beats wiring events across that tree.
 */
export const signingOut = ref(false);

/**
 * How long the shutdown log holds before the router moves to /login. Short
 * enough to read as a beat, not a wait — the server call itself already runs
 * in the background (see stores/auth.ts).
 */
export const SIGN_OUT_BEAT_MS = 750;
