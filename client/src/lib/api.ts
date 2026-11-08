export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string> | unknown,
  ) {
    super(message);
  }
  /** Field-level validation errors returned by the server (if any). */
  get fieldErrors(): Record<string, string> {
    return this.details && typeof this.details === 'object' ? (this.details as Record<string, string>) : {};
  }
}

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

type Options = Omit<RequestInit, 'body'> & { body?: unknown; query?: Record<string, unknown> };

export function qs(query?: Record<string, unknown>) {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { body, query, headers, ...rest } = opts;
  const isForm = body instanceof FormData;
  const res = await fetch(`${BASE}/api${path}${qs(query)}`, {
    credentials: 'include',
    ...rest,
    headers: {
      // Required by the server's CSRF guard for every state-changing request
      'X-Requested-With': 'SakshiMobile',
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.error ? data.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, typeof data === 'object' ? data?.details : undefined);
  }
  return data as T;
}

export const get = <T,>(path: string, query?: Record<string, unknown>) => api<T>(path, { query });
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const put = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: body ?? {} });
export const patch = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body: body ?? {} });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });

/** Download a file (CSV, backup) from an authenticated endpoint. */
export async function download(path: string, query?: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api${path}${qs(query)}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, 'Download failed');
  const blob = await res.blob();
  const name = res.headers.get('content-disposition')?.match(/filename="(.+?)"/)?.[1] ?? 'download';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const assetUrl = (url: string | null | undefined) => (!url ? '' : url.startsWith('/') ? `${BASE}${url}` : url);

/** Cloudinary on-the-fly resizing for responsive images. */
export function imageSrc(url: string | null | undefined, width = 800) {
  const u = assetUrl(url);
  if (!u.includes('res.cloudinary.com') || u.includes('/upload/f_auto')) return u;
  return u.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

export function imageSrcSet(url: string | null | undefined, widths = [320, 480, 640, 960]) {
  const u = assetUrl(url);
  if (!u.includes('res.cloudinary.com')) return undefined;
  return widths.map((w) => `${imageSrc(u, w)} ${w}w`).join(', ');
}
