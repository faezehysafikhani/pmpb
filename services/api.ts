/**
 * The only door to the backend. The UI holds no business rules: it sends what the user typed and shows what the
 * backend answers. Requests go to this app's own origin; server.ts forwards /api to the .NET backend.
 *
 * Errors: the backend answers failures as RFC 7807 problem details (`title` is the error code such as "conflict",
 * `detail` the message). They are returned as `ApiError` so screens can show the backend's own message.
 */

export interface ApiError {
  status: number;
  /** Error code from the backend (validation.error, not_found, conflict, forbidden, unauthorized.captcha_required, ...). */
  code: string;
  message: string;
}

export interface ApiResult<T> {
  ok: boolean;
  value?: T;
  error?: ApiError;
}

const ACCESS_KEY = 'pms_access_token';
const REFRESH_KEY = 'pms_refresh_token';

export const tokenStore = {
  get access(): string | null {
    try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
  },
  get refresh(): string | null {
    try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
  },
  set(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch { /* storage unavailable: the session just will not survive a reload */ }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch { /* ignore */ }
  }
};

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, however many requests found the token expired together. */
async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const response = await fetch('/api/identity/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!response.ok) return false;
      const data = await response.json();
      tokenStore.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

async function toError(response: Response): Promise<ApiError> {
  let code = `http.${response.status}`;
  let message = `${response.status} ${response.statusText}`.trim();
  try {
    const body = await response.json();
    if (body?.title) code = String(body.title);
    if (body?.detail) message = String(body.detail);
    else if (body?.error) message = String(body.error);
  } catch { /* not JSON: keep the status text */ }
  return { status: response.status, code, message };
}

/** Raised for 401 so the app can send the user back to the sign-in page. */
export const sessionEvents = new EventTarget();

async function send<T>(method: string, url: string, body?: unknown, retry = true): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  // A FormData body (a file upload) sets its own multipart content type, with the boundary.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const token = tokenStore.access;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
  } catch (err: any) {
    return { ok: false, error: { status: 0, code: 'network', message: err?.message || 'The server could not be reached.' } };
  }

  if (response.status === 401 && retry && token && !url.startsWith('/api/identity/auth/')) {
    if (await refreshSession()) return send<T>(method, url, body, false);
    tokenStore.clear();
    sessionEvents.dispatchEvent(new Event('expired'));
  }

  if (!response.ok) return { ok: false, error: await toError(response) };
  if (response.status === 204) return { ok: true, value: undefined as T };
  const text = await response.text();
  return { ok: true, value: (text ? JSON.parse(text) : undefined) as T };
}

/** Fetches a file with the session's token and hands it to the browser to save (the backend names it in Content-Disposition). */
async function download(url: string, fallbackName: string, retry = true): Promise<ApiResult<void>> {
  const token = tokenStore.access;
  let response: Response;
  try {
    response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch (err: any) {
    return { ok: false, error: { status: 0, code: 'network', message: err?.message || 'The server could not be reached.' } };
  }
  if (response.status === 401 && retry && token && await refreshSession()) return download(url, fallbackName, false);
  if (!response.ok) return { ok: false, error: await toError(response) };

  const disposition = response.headers.get('content-disposition') || '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  let name = fallbackName;
  try { name = encoded ? decodeURIComponent(encoded) : plain || fallbackName; } catch { name = plain || fallbackName; }

  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return { ok: true, value: undefined };
}

export const api = {
  download,
  get: <T>(url: string) => send<T>('GET', url),
  post: <T>(url: string, body?: unknown) => send<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => send<T>('PUT', url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => send<T>('PATCH', url, body ?? {}),
  delete: <T>(url: string) => send<T>('DELETE', url)
};

/** Builds `?a=1&b=2`, leaving out undefined/null/empty values. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Unwraps a result or throws the backend's message (for call sites that just want to show it). */
export function must<T>(result: ApiResult<T>): T {
  if (result.ok) return result.value as T;
  throw new Error(result.error?.message || 'Request failed');
}
