import { readonly, ref } from 'vue';

/**
 * Live API telemetry — latency and health of the *real* traffic the app is
 * already making, not a synthetic ping.
 *
 * Why this instead of polling a health endpoint: a status lamp must never lie.
 * Ping something separate and it can glow green while every actual request
 * fails (bad proxy, expired session). Measuring the requests the user is
 * already waiting on means the lamp means exactly what it appears to mean.
 */
const latency = ref<number | null>(null);
const lastOkAt = ref<number | null>(null);
const errors = ref(0);

/** Called by the axios interceptors for every request the app makes. */
export function recordApiResult(ms: number, ok: boolean) {
  latency.value = Math.round(ms);
  if (ok) {
    lastOkAt.value = Date.now();
    errors.value = 0;
  } else {
    errors.value += 1;
  }
}

export function useApiTelemetry() {
  return {
    latency: readonly(latency),
    lastOkAt: readonly(lastOkAt),
    errors: readonly(errors),
  };
}
