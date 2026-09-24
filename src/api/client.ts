/**
 * One HTTP client for the whole app. Every call goes through here so that
 * credentials, error shape and the base path are decided in exactly one place.
 *
 * In development Vite proxies /api to the Node server (see vite.config.ts), so
 * the browser sees a single origin and the session cookie travels normally.
 */

/**
 * Where the API is, which is almost always "the same place this page came
 * from".
 *
 * The default is a relative path on purpose. One origin is what lets the
 * session cookie travel without CORS having to be right, and it is why the
 * server can serve this bundle itself on a bare IP with no nginx.
 *
 * `VITE_API_URL` overrides it for the case that default cannot cover - the
 * client deployed somewhere the API is not, a CDN, a separate host. Point it
 * at another origin and the cookie becomes a cross-origin one: the server's
 * CLIENT_ORIGIN must name this exact address, and over plain http a browser
 * will still refuse a `secure` cookie. Worth knowing before reaching for it.
 *
 * Read at build time, so it is baked into the bundle. Changing it means
 * building again, and it is readable by anyone - never put a secret here.
 */
const BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    fields?: { path: string; message: string }[];
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: { path: string; message: string }[],
    /** Whatever the server attached - e.g. look-alike branches on a 409. */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // A FormData body must set its own Content-Type: the boundary is generated
  // by the browser, and overriding the header makes the upload unparseable.
  const isForm = init.body instanceof FormData;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `Request failed with ${res.status}`,
      err?.fields,
      err?.details,
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /** Multipart, for endpoints that take a file. */
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),

  /**
   * Posts, and gets bytes back rather than JSON.
   *
   * For a generated file that is shown rather than saved - a preview the
   * browser renders from a blob it already holds, so nothing has to be stored
   * on the server to be looked at.
   */
  postForBlob: async (path: string, data: unknown): Promise<Blob> => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data ?? {}),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'UNKNOWN',
        body?.error?.message ?? 'Could not build that.',
        body?.error?.fields,
      );
    }

    return res.blob();
  },

  /**
   * Fetches a generated file and hands it to the browser as a download.
   *
   * It goes through fetch rather than a plain link because the endpoint is
   * behind the session and returns JSON on failure - a link would navigate
   * away from the app and show the error as a bare page.
   */
  download: async (path: string, filename: string): Promise<void> => {
    const res = await fetch(`${BASE}${path}`, { credentials: 'include' });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'UNKNOWN',
        body?.error?.message ?? 'Could not download that file.',
      );
    }

    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked on the next tick: Safari needs the URL to survive the click.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  },
};
