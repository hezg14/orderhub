import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';

/**
 * Reactive `matchMedia`. One source of truth for behaviour that has to *switch
 * markup* rather than just restyle it — a data table becoming a card list, for
 * instance, which CSS alone cannot express.
 *
 * CSS media queries remain the default for styling; reach for this only when
 * the DOM itself must differ.
 */
export function useMediaQuery(query: string) {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const mql = supported ? window.matchMedia(query) : null;
  const matches = ref(mql?.matches ?? false);

  const onChange = (event: MediaQueryListEvent) => {
    matches.value = event.matches;
  };

  onMounted(() => mql?.addEventListener('change', onChange));
  onBeforeUnmount(() => mql?.removeEventListener('change', onChange));

  return readonly(matches);
}

/** Below this width the product is a phone layout: single column, no tables. */
export const MOBILE_QUERY = '(max-width: 767px)';
