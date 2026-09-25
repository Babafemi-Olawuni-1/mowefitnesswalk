/**
 * Centralised API client.
 *
 * The base URL comes from VITE_API_URL. There is no hardcoded backend
 * domain anywhere in src/ any more.
 *
 * Only PUBLIC values may ever be read from import.meta.env. The Supabase
 * service role key is a server-side secret and must never appear in a
 * VITE_ variable.
 */

const trimmedBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

/** Ensure base URL always includes the /api prefix */
export const API_URL = trimmedBase && !trimmedBase.endsWith('/api')
  ? `${trimmedBase}/api`
  : trimmedBase;

export const ADMIN_TOKEN_KEY = 'admin_token';

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string>;
};

/** Thrown for any non-2xx response, carrying the server's field errors. */
export class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;

  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/** Called when the server rejects our session, so the app can sign out. */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Private browsing can block storage. Not fatal.
  }
}

export function clearStoredToken() {
  setStoredToken(null);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** JSON body. Mutually exclusive with formData. */
  body?: unknown;
  /** multipart/form-data body. Do not set Content-Type manually. */
  formData?: FormData;
  /** Attach the stored admin bearer token. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
};

/**
 * Perform an API request and unwrap the standard envelope.
 *
 * On 401 the stored session is cleared and the registered handler runs, so
 * the UI returns to the login screen instead of hanging on a spinner.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, formData, auth = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };

  if (auth) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Let the browser set the multipart boundary itself.
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(0, 'Network error. Please check your connection and try again.');
  }

  if (response.status === 401) {
    clearStoredToken();
    onUnauthorized?.();
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  // File downloads and other non-JSON responses.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(response.status, `Request failed (${response.status}).`);
    }
    return (await response.blob()) as T;
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      response.status,
      payload.message || 'Request failed.',
      payload.errors
    );
  }

  return payload.data as T;
}

/**
 * Extract a bare participant id from whatever a QR scanner returned.
 *
 * A scanner may give us a bare id, the current verification URL, or the
 * legacy verify.php URL. The old code passed the whole URL to the API,
 * which is why scanning was broken.
 */
export function extractParticipantId(raw: string): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  const bare = /^[A-Za-z0-9]+-\d{1,12}$/;
  if (bare.test(value)) return value.toUpperCase();

  try {
    const url = new URL(
      value.startsWith('http') ? value : `https://x/?q=${encodeURIComponent(value)}`
    );

    const fromQuery = url.searchParams.get('id');
    if (fromQuery && bare.test(fromQuery)) return fromQuery.toUpperCase();

    const fromHash = url.hash.replace(/^#/, '');
    if (fromHash && bare.test(fromHash)) return fromHash.toUpperCase();

    const lastSegment = url.pathname.split('/').filter(Boolean).pop();
    if (lastSegment && bare.test(lastSegment)) return lastSegment.toUpperCase();
  } catch {
    return null;
  }

  return null;
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ── Typed endpoint helpers ─────────────────────────────────────────────

export type Sponsor = {
  id: number;
  business_name: string;
  logo_url?: string | null;
  website_url?: string | null;
  whatsapp?: string | null;
  description?: string | null;
  priority?: number;
  status?: string;
};

export type RegisterResult = {
  participant_id: string;
  full_name?: string;
  registered_at?: string;
  pass_url: string | null;
  qr_url: string | null;
  verify_url: string;
  email_status?: string;
};

export type VerifyResult = {
  participant_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  registered_at: string;
  registered_on: string;
  valid: boolean;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export const api = {
  // Public
  register: (formData: FormData) =>
    apiFetch<RegisterResult>('/register', { method: 'POST', formData, auth: false }),

  verify: (participantId: string) =>
    apiFetch<VerifyResult>(`/verify/${encodeURIComponent(participantId)}`, { auth: false }),

  sponsors: () => apiFetch<Sponsor[]>('/sponsors', { auth: false }),

  gallery: () => apiFetch<unknown[]>('/gallery', { auth: false }),

  event: () => apiFetch<Record<string, unknown>>('/event', { auth: false }),

  contact: (body: unknown) =>
    apiFetch<null>('/contact', { method: 'POST', body, auth: false }),

  // Auth
  login: (email: string, password: string) =>
    apiFetch<{
      token: string;
      refresh_token: string;
      expires_in: number;
      admin: AdminUser;
    }>('/admin/login', { method: 'POST', body: { email, password }, auth: false }),

  // Admin
  dashboard: () =>
    apiFetch<{
      stats: {
        total: number;
        today: number;
        verified: number;
        cancelled: number;
        week_chart: Array<{ d: string; cnt: number }>;
      };
      sponsor_count: number;
      unread_messages: number;
    }>('/admin/dashboard'),

  participants: (page = 1, search = '', status = '') => {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    return apiFetch<{
      data: Array<Record<string, unknown>>;
      total: number;
      page: number;
      per_page: number;
      last_page: number;
    }>(`/admin/participants?${params.toString()}`);
  },

  adminSponsors: () => apiFetch<Sponsor[]>('/admin/sponsors'),

  createSponsor: (formData: FormData) =>
    apiFetch<{ id: number }>('/admin/sponsors', { method: 'POST', formData }),

  exportUrl: (type: 'participants' | 'sponsors' | 'contacts') =>
    `${API_URL}/admin/export/${type}`,
};

export default api;
