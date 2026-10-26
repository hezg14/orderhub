import { recordApiResult } from '@/composables/useApiTelemetry';
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { currentLocale } from '@/i18n';

/**
 * Normalised API failure. Components switch on `code`, never on the message —
 * messages are for humans and may be reworded at any time.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors keyed by dot-path, ready for a form's error map. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as { field: string; message: string }[]).map((d) => [d.field, d.message]),
    );
  }
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api',
  withCredentials: true,
  timeout: 20_000,
});

// Server-generated wording (report columns, state-machine hints) follows the
// UI locale via this header; read per-request so a locale switch applies
// immediately without touching the instance.
/** Request start timestamps, keyed by axios config, for the telemetry lamp. */
type TimedConfig = InternalAxiosRequestConfig & { __t0?: number };

const elapsed = (config?: TimedConfig) =>
  config?.__t0 === undefined ? 0 : performance.now() - config.__t0;

client.interceptors.request.use((config: TimedConfig) => {
  config.headers.set('Accept-Language', currentLocale());
  config.__t0 = performance.now();
  return config;
});

client.interceptors.response.use(
  (response) => {
    recordApiResult(elapsed(response.config as TimedConfig), true);
    return response;
  },
  (error: AxiosError<{ error?: { code: string; message: string; details?: unknown; requestId?: string } }>) => {
    recordApiResult(elapsed(error.config as TimedConfig | undefined), false);

    if (!error.response) {
      return Promise.reject(
        new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check your connection.', 0),
      );
    }

    const { status, data } = error.response;
    const payload = data?.error;
    const apiError = new ApiError(
      payload?.code ?? 'INTERNAL_ERROR',
      payload?.message ?? 'Something went wrong',
      status,
      payload?.details,
      payload?.requestId,
    );

    // A dead session should land on the login page once, not in every caller.
    if (status === 401 && !location.pathname.startsWith('/login')) {
      const next = encodeURIComponent(location.pathname + location.search);
      // Defer so the rejection still reaches the caller for its own handling.
      setTimeout(() => location.assign(`/login?next=${next}`), 0);
    }

    return Promise.reject(apiError);
  },
);

export const http = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return client.get<T>(url, config).then((r) => r.data);
  },
  post<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
    return client.post<T>(url, body, config).then((r) => r.data);
  },
  patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
    return client.patch<T>(url, body, config).then((r) => r.data);
  },
  delete<T>(url: string, config?: AxiosRequestConfig) {
    return client.delete<T>(url, config).then((r) => r.data);
  },
  /** Authenticated binary download (CSV export). */
  async download(url: string, filename: string, params?: Record<string, unknown>) {
    const response = await client.get<Blob>(url, { params, responseType: 'blob' });
    const objectUrl = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return Number(response.headers['x-total-rows'] ?? 0);
  },
};
