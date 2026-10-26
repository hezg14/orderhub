import { ref } from 'vue';

/**
 * Command-palette open state.
 *
 * Module-level singleton on purpose: the trigger lives in the topbar while the
 * panel itself is teleported to <body>, and a keyboard shortcut has to be able
 * to open it from anywhere. Props/events across that boundary would be noise.
 */
const open = ref(false);

export function useCommandPalette() {
  return {
    open,
    show: () => (open.value = true),
    hide: () => (open.value = false),
    toggle: () => (open.value = !open.value),
  };
}
