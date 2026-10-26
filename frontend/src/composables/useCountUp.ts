import { ref, watch, onBeforeUnmount, type Ref } from 'vue';

/**
 * Animates a number from its previous value to the new one (ease-out cubic).
 * ToB dashboards live or die by "data feels alive": a 700 ms count-up on KPI
 * change reads as polish, a 0 ms jump reads as a spreadsheet.
 *
 * Returns the animated display value; feed it the reactive source number.
 */
export function useCountUp(source: Ref<number | null | undefined>, duration = 700) {
  const shown = ref(0);
  let raf = 0;

  function animateTo(target: number) {
    cancelAnimationFrame(raf);
    const from = shown.value;
    if (target === from) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      shown.value = from + (target - from) * eased;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  watch(
    source,
    (next) => {
      if (typeof next === 'number' && Number.isFinite(next)) animateTo(next);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => cancelAnimationFrame(raf));

  return shown;
}
