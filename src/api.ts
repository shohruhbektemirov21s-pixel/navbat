import {
  OperatingPartnerOverview,
  CRMLead,
  PartnerCommission,
  CommissionSummary,
  PartnerReport,
  SupportTicket,
  OperatingAuditLog
} from './types';

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'navbatbor_token';
const REFRESH_KEY = 'navbatbor_refresh';

/** Fired on `window` when the session is gone (refresh failed / revoked). */
export const UNAUTHORIZED_EVENT = 'navbatbor:unauthorized';

const THROTTLE_MESSAGE = "Juda ko'p so'rov, birozdan so'ng urinib ko'ring";
const NETWORK_MESSAGE = "Server bilan aloqa yo'q. Internet ulanishini tekshirib, qayta urinib ko'ring";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable (private mode / sandboxed iframe) — session stays in-memory only
  }
}

function getStoredToken(): string | null {
  return safeGet(TOKEN_KEY);
}

function getStoredRefresh(): string | null {
  return safeGet(REFRESH_KEY);
}

/** True when an access or refresh token is stored (a session may be restorable). */
export function hasStoredSession(): boolean {
  return Boolean(getStoredToken() || getStoredRefresh());
}

/**
 * Persists the access token and (optionally) the refresh token.
 * Passing `null` as token clears both. Passing `undefined` as refresh keeps the current one.
 */
export function setStoredToken(token: string | null, refresh?: string | null) {
  safeSet(TOKEN_KEY, token);
  if (!token) {
    safeSet(REFRESH_KEY, null);
  } else if (refresh !== undefined) {
    safeSet(REFRESH_KEY, refresh);
  }
}

/** Shape shared by every auth endpoint that issues tokens. */
export interface AuthTokensResponse {
  token?: string;
  refresh?: string;
  /** Legacy field name used by older backend builds. */
  refreshToken?: string;
}

/** Extracts the refresh token from an auth response (tolerates the legacy `refreshToken` field). */
export function refreshFrom(res: AuthTokensResponse | null | undefined): string | null {
  return res?.refresh || res?.refreshToken || null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** Flattens DRF-style error payloads (`string | string[] | {field: [msg]}`) into one readable line. */
function flattenErrorValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined || depth > 3) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => flattenErrorValue(v, depth + 1)).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((v) => flattenErrorValue(v, depth + 1))
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

function extractErrorMessage(data: any, status: number): string {
  if (status === 429) return THROTTLE_MESSAGE;
  const message =
    flattenErrorValue(data?.error) || flattenErrorValue(data?.detail) || flattenErrorValue(data?.message);
  if (message) return message;
  if (status >= 500) return `Serverda vaqtinchalik xatolik (${status}). Birozdan so'ng qayta urinib ko'ring`;
  if (status === 404) return "So'ralgan ma'lumot topilmadi (404)";
  if (status === 403) return "Ushbu amal uchun ruxsat yo'q (403)";
  if (status === 401) return 'Sessiya muddati tugadi. Iltimos, qayta kiring';
  return `Serverda xatolik (${status})`;
}

async function parseBody(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 204) return {};
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
  try {
    const text = await response.text();
    // Never surface raw HTML error pages (Django debug / proxy pages) to the user.
    if (!text || contentType.includes('text/html') || text.trimStart().startsWith('<')) return {};
    return { error: text.slice(0, 300) };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Refresh flow (single-flight)
// ---------------------------------------------------------------------------

/** Endpoints that must never trigger the refresh-and-retry cycle. */
const AUTH_ENDPOINT_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/telegram-webapp',
  '/api/auth/telegram-session',
  '/api/auth/telegram-quick-login',
];

function isAuthEndpoint(endpoint: string): boolean {
  return AUTH_ENDPOINT_PREFIXES.some((prefix) => endpoint.startsWith(prefix));
}

type RefreshOutcome = 'refreshed' | 'invalid' | 'network-error';

let refreshInFlight: Promise<RefreshOutcome> | null = null;

function refreshAccessToken(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;

  const refresh = getStoredRefresh();
  if (!refresh) return Promise.resolve('invalid');

  refreshInFlight = (async (): Promise<RefreshOutcome> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) {
        // 5xx / 429 are transient: keep the session and let the caller retry later.
        return response.status >= 500 || response.status === 429 ? 'network-error' : 'invalid';
      }
      const data = await parseBody(response);
      const nextToken: string | undefined = data?.token || data?.access;
      if (!nextToken) return 'invalid';
      setStoredToken(nextToken, refreshFrom(data) ?? refresh);
      return 'refreshed';
    } catch {
      return 'network-error';
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Clears the dead session and notifies the app once (concurrent callers are de-duplicated). */
function signalSessionExpired() {
  const hadSession = hasStoredSession();
  setStoredToken(null);
  if (hadSession && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

async function request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, { ...options, headers });
  } catch (err) {
    // Let aborts propagate untouched so callers can ignore them.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(NETWORK_MESSAGE, 0);
  }

  if (response.status === 401 && !isAuthEndpoint(endpoint) && !isRetry && (token || getStoredRefresh())) {
    // Another request may already have rotated the token while this one was in flight.
    const current = getStoredToken();
    if (current && current !== token) {
      return request<T>(endpoint, options, true);
    }
    const outcome = await refreshAccessToken();
    if (outcome === 'refreshed') {
      return request<T>(endpoint, options, true);
    }
    if (outcome === 'invalid') {
      signalSessionExpired();
      // Retry once anonymously: public endpoints (categories, catalog…) reject *invalid*
      // tokens with 401 even though they need none. Protected ones simply 401 again.
      return request<T>(endpoint, options, true);
    }
  } else if (response.status === 401 && isRetry && token && !isAuthEndpoint(endpoint)) {
    // A freshly refreshed token was still rejected — the session is revoked.
    signalSessionExpired();
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(data, response.status), response.status, data);
  }

  return data as T;
}

/** True when the error is an AbortController cancellation (safe to ignore). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export const api = {
  // Auth
  register: (body: { email: string; password: string; name: string; phone?: string }) =>
    request<{ user: any } & AuthTokensResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: any } & AuthTokensResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  loginWithTelegramWebApp: (data: { initData: string; user?: any }) =>
    request<{ user: any; token: string } & AuthTokensResponse>('/api/auth/telegram-webapp', { method: 'POST', body: JSON.stringify(data) }),
  createTelegramAuthSession: () =>
    request<{ sessionId: string; code: string; botUsername: string; botUrl: string; deepLink: string; tgDirect: string; expiresAt: string }>('/api/auth/telegram-session', { method: 'POST' }),
  checkTelegramAuthSession: (sessionId: string) =>
    request<{ status: 'PENDING' | 'CONFIRMED' | 'EXPIRED'; token?: string; user?: any } & AuthTokensResponse>(`/api/auth/telegram-session/${sessionId}`),
  quickTelegramLogin: (data: { phone?: string; name?: string; username?: string; sessionId?: string; code?: string }) =>
    request<{ success: boolean; token: string; user: any; message: string } & AuthTokensResponse>('/api/auth/telegram-quick-login', { method: 'POST', body: JSON.stringify(data) }),
  /** Blacklists the refresh token server-side. Callers must still clear local tokens. */
  logout: () =>
    request<any>('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refresh: getStoredRefresh() }) }),
  getMe: () => request<{ user: any }>('/api/auth/me'),

  // Public Marketplace
  getCategories: () => request<any[]>('/api/categories'),
  getCities: () => request<any[]>('/api/cities'),
  getPublicStats: () =>
    request<{
      businesses: number;
      customers: number;
      queues: number;
      bookings: number;
      activeQueueCount: number;
      todaysBookingsCount: number;
    }>('/api/public-stats'),
  getBusinesses: (
    params: { q?: string; category?: string; city?: string; sort?: string; page?: number; limit?: number; lat?: number; lng?: number },
    signal?: AbortSignal
  ) => {
    const qp = new URLSearchParams();
    if (params.q) qp.set('q', params.q);
    if (params.category) qp.set('category', params.category);
    if (params.city) qp.set('city', params.city);
    if (params.sort) qp.set('sort', params.sort);
    if (params.page) qp.set('page', params.page.toString());
    if (params.limit) qp.set('limit', params.limit.toString());
    if (params.lat !== undefined && params.lng !== undefined) {
      qp.set('lat', params.lat.toString());
      qp.set('lng', params.lng.toString());
    }
    return request<{ items: any[]; total: number; page: number; limit: number; totalPages: number; user_coords?: { lat: number; lng: number } }>(`/api/businesses?${qp.toString()}`, { signal });
  },
  getBusinessBySlug: (slug: string, coords?: { lat: number; lng: number }) => {
    const qp = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';
    return request<{ business: any; services: any[]; staff: any[]; hours: any[]; reviews: any[] }>(`/api/businesses/${slug}${qp}`);
  },
  getAvailableSlots: (bizId: string, date: string, staffId: string, serviceId: string) =>
    request<{ slots: string[]; reason?: string; suggested_date?: string; suggested_date_formatted?: string }>(`/api/businesses/${bizId}/available-slots?date=${date}&staff_id=${staffId}&service_id=${serviceId}`),

  // Booking
  createBooking: (data: any) => request<any>('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),
  getCustomerBookings: (status?: string, signal?: AbortSignal) => request<any[]>(`/api/customer/bookings${status ? `?status=${status}` : ''}`, { signal }),
  cancelBooking: (id: string, reason?: string) => request<any>(`/api/customer/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rescheduleBooking: (id: string, date: string, time: string) =>
    request<any>(`/api/customer/bookings/${id}/reschedule`, { method: 'POST', body: JSON.stringify({ booking_date: date, start_time: time }) }),
  sendBookingReminder: (id: string) => request<any>(`/api/bookings/${id}/send-reminder`, { method: 'POST' }),

  // Digital Queue
  joinQueue: (data: any) => request<any>('/api/queue/join', { method: 'POST', body: JSON.stringify(data) }),
  getMyActiveQueue: () => request<{ activeQueue: any | null }>('/api/queue/my-active'),
  getBusinessQueue: (bizId: string) => request<any[]>(`/api/business/${bizId}/queue`),
  queueAction: (id: string, action: 'CALL' | 'SERVE' | 'COMPLETE' | 'SKIP' | 'NO_SHOW') =>
    request<any>(`/api/business/queue/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),
  confirmNextCustomer: (pendingActionId?: string, businessId?: string) =>
    request<{ success: boolean; message: string; calledCustomer: any; previousCustomer: any }>('/api/queue/next/confirm', {
      method: 'POST',
      body: JSON.stringify({ pending_action_id: pendingActionId, business_id: businessId })
    }),
  cancelPendingQueueAction: (pendingActionId: string) =>
    request<{ success: boolean; message: string }>('/api/queue/pending-cancel', {
      method: 'POST',
      body: JSON.stringify({ pending_action_id: pendingActionId })
    }),
  getPendingQueueStatus: (pendingActionId: string) =>
    request<{
      status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
      confirmed_at?: string;
      expires_at: string;
      calledCustomer?: any;
    }>(`/api/queue/pending-status/${pendingActionId}`),
  completeQueueService: (businessId: string, entryId?: string) =>
    request<{ success: boolean; message: string; completedCustomer: any }>('/api/queue/complete', {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId, entry_id: entryId })
    }),
  noShowQueueCustomer: (businessId: string, entryId: string) =>
    request<{ success: boolean; message: string }>('/api/queue/no-show', {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId, entry_id: entryId })
    }),
  getCurrentQueueState: (businessId: string) =>
    request<{
      currentCustomer: any | null;
      nextCustomer: any | null;
      waitingCount: number;
      servedToday: number;
      pendingAction: any | null;
    }>(`/api/queue/current?business_id=${businessId}`),
  getQueueAuditLogs: (businessId: string) =>
    request<any[]>(`/api/queue/audit-logs/${businessId}`),

  // Dedicated Operator Queue Controls
  operatorCallNext: (businessId: string) =>
    request<{
      success: boolean;
      message: string;
      calledCustomer: any;
      previousCustomer: any;
    }>('/api/operator/queue/call-next', {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId })
    }),
  operatorAccept: (entryId: string) =>
    request<{ success: boolean; status: string; message: string }>('/api/operator/queue/accept', {
      method: 'POST',
      body: JSON.stringify({ entry_id: entryId })
    }),
  operatorCancel: (entryId: string) =>
    request<{ success: boolean; status: string; message: string }>('/api/operator/queue/cancel', {
      method: 'POST',
      body: JSON.stringify({ entry_id: entryId })
    }),

  // QR Code Instant Check-in
  resolveQRCode: (code: string) =>
    request<{
      type: 'business' | 'booking' | 'queue_ticket';
      business?: any;
      liveQueue?: { activeCount: number; estimatedWaitMinutes: number; avgDurationMinutes: number };
      services?: any[];
      booking?: any;
      queue?: any;
    }>('/api/check-in/resolve', { method: 'POST', body: JSON.stringify({ code }) }),

  // Reviews
  createReview: (data: any) => request<any>('/api/reviews', { method: 'POST', body: JSON.stringify(data) }),

  // Business Dashboard & CRM
  getCurrentBusiness: () => request<{ business: any; stats: any }>('/api/business/current'),
  getCalendarBookings: (startDate?: string, endDate?: string) => {
    const qp = new URLSearchParams();
    if (startDate) qp.set('start_date', startDate);
    if (endDate) qp.set('end_date', endDate);
    return request<any[]>(`/api/business/calendar?${qp.toString()}`);
  },
  updateBookingStatus: (id: string, status: string) => request<any>(`/api/business/bookings/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  getCRMCustomers: (q?: string, signal?: AbortSignal) => request<any[]>(`/api/business/crm/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`, { signal }),
  getBusinessServices: () => request<any[]>('/api/business/services'),
  createBusinessService: (data: any) => request<any>('/api/business/services', { method: 'POST', body: JSON.stringify(data) }),
  deleteBusinessService: (id: string) => request<any>(`/api/business/services/${id}`, { method: 'DELETE' }),
  getBusinessStaff: () => request<any[]>('/api/business/staff'),
  createBusinessStaff: (data: any) => request<any>('/api/business/staff', { method: 'POST', body: JSON.stringify(data) }),

  // Telegram-based business onboarding (replaces the old self-service web form)
  getTelegramBusinessConnectLink: () =>
    request<{ botUsername: string; deepLink: string }>('/api/telegram/business-connect-link', { method: 'POST' }),

  // Subscriptions & Telegram (1 Month Validity & 14-Day Free Trial)
  getBusinessSubscription: () => request<any>('/api/business/subscription'),
  requestTelegramPayment: (data: { plan_code: string }) =>
    request<{
      success: boolean;
      transactionId: string;
      message: string;
      telegramUrl: string;
      plan: any;
      status: string;
    }>('/api/business/request-telegram-payment', { method: 'POST', body: JSON.stringify(data) }),
  confirmAdminPayment: (id: string) => request<any>(`/api/admin/subscription-transactions/${id}/confirm`, { method: 'POST' }),
  cancelAdminPayment: (id: string) => request<any>(`/api/admin/subscription-transactions/${id}/cancel`, { method: 'POST' }),
  updateBusinessTelegram: (data: { telegram_chat_id: string; telegram_channel_or_group?: string; send_test?: boolean }) =>
    request<any>('/api/business/telegram-settings', { method: 'POST', body: JSON.stringify(data) }),
  sendTestTelegram: (data: { chat_id: string; message?: string }) =>
    request<any>('/api/telegram/test', { method: 'POST', body: JSON.stringify(data) }),
  generateTelegramLinkToken: () =>
    request<{ linkToken: string; deepLink: string; botUsername: string }>('/api/telegram/generate-link-token', { method: 'POST' }),
  sendQueueTicketToTelegram: (entryId: string, chatId?: string) =>
    request<{ success: boolean; message: string; details?: any }>(`/api/queue/${entryId}/send-to-telegram`, { method: 'POST', body: JSON.stringify({ chat_id: chatId }) }),
  sendBookingVoucherToTelegram: (bookingId: string, chatId?: string) =>
    request<{ success: boolean; message: string; details?: any }>(`/api/bookings/${bookingId}/send-to-telegram`, { method: 'POST', body: JSON.stringify({ chat_id: chatId }) }),

  // Admin Panel (Advanced & Comprehensive)
  getAdminOverview: () => request<any>('/api/admin/overview'),
  getAdminCharts: () => request<any>('/api/admin/stats-charts'),
  getAdminBusinesses: () => request<any[]>('/api/admin/businesses'),
  updateAdminBusinessStatus: (id: string, data: { status?: string; is_verified?: boolean; reason?: string }) =>
    request<any>(`/api/admin/businesses/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
  getAdminAllBookings: (params: { status?: string; q?: string; page?: number; limit?: number }, signal?: AbortSignal) => {
    const qp = new URLSearchParams();
    if (params.status) qp.set('status', params.status);
    if (params.q) qp.set('q', params.q);
    if (params.page) qp.set('page', String(params.page));
    if (params.limit) qp.set('limit', String(params.limit));
    return request<{ bookings: any[]; total: number; page: number; totalPages: number }>(`/api/admin/all-bookings?${qp.toString()}`, { signal });
  },
  updateAdminBookingStatus: (id: string, status: string) =>
    request<any>(`/api/admin/bookings/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  getAdminSubscriptions: () => request<{ subscriptions: any[]; transactions: any[] }>('/api/admin/subscriptions'),
  extendAdminSubscription: (bizId: string, data: { months?: number; plan_code?: string }) =>
    request<any>(`/api/admin/businesses/${bizId}/extend-subscription`, { method: 'POST', body: JSON.stringify(data) }),
  getAdminTelegramLogs: () => request<any[]>('/api/admin/telegram-logs'),
  sendAdminTelegram: (data: { chat_id: string; message: string }) =>
    request<any>('/api/admin/telegram/send', { method: 'POST', body: JSON.stringify(data) }),
  getAdminSystemHealth: () => request<any>('/api/admin/system-health'),
  getAdminUsers: () => request<any[]>('/api/admin/users'),
  createAdminUser: (data: { name: string; email: string; phone?: string; password: string; role?: string }) =>
    request<any>('/api/admin/users/create', { method: 'POST', body: JSON.stringify(data) }),
  resetAdminUserPassword: (id: string, password: string) =>
    request<any>(`/api/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
  updateAdminUserStatus: (id: string, data: { status?: string; role?: string; reason?: string }) =>
    request<any>(`/api/admin/users/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
  getAdminAuditLogs: () => request<any[]>('/api/admin/audit-logs'),
  getAdminReviews: () => request<any[]>('/api/admin/reviews'),
  deleteAdminReview: (id: string) => request<any>(`/api/admin/reviews/${id}/delete`, { method: 'POST' }),
  getAdminPromotions: () => request<any[]>('/api/admin/promotions'),
  getAdminReports: () => request<any>('/api/admin/reports'),

  // Telegram bot business applications (review queue)
  getBusinessApplications: (status?: string) =>
    request<any[]>(`/api/admin/business-applications?status=${status ?? 'PENDING'}`),
  approveBusinessApplication: (id: string) =>
    request<{ success: boolean; business_id: string; business_slug: string }>(
      `/api/admin/business-applications/${id}/approve`,
      { method: 'POST' }
    ),
  rejectBusinessApplication: (id: string, reason: string) =>
    request<{ success: boolean }>(`/api/admin/business-applications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Notifications
  getNotifications: () => request<any[]>('/api/notifications'),
  markNotificationAsRead: (id: string) => request<any>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsAsRead: () => request<any>('/api/notifications/read-all', { method: 'POST' }),

  // Customer Favorites & Profile
  getCustomerFavorites: () => request<any[]>('/api/customer/favorites'),
  getCustomerFavoriteIds: () => request<string[]>('/api/customer/favorites/ids'),
  toggleCustomerFavorite: (businessId: string) => request<{ isSaved: boolean }>(`/api/customer/favorites/${businessId}/toggle`, { method: 'POST' }),
  updateCustomerProfile: (data: { name?: string; phone?: string; telegram_chat_id?: string }) =>
    request<any>('/api/customer/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Business Hours & Promotion
  getBusinessWorkingHours: () => request<any[]>('/api/business/working-hours'),
  updateBusinessWorkingHours: (hours: any[]) => request<any>('/api/business/working-hours', { method: 'PUT', body: JSON.stringify({ hours }) }),
  promoteBusiness: (data: { duration_days?: number; payment_method?: string }) =>
    request<any>('/api/business/promote', { method: 'POST', body: JSON.stringify(data) }),
  getBusinessAdAnalytics: () => request<any>('/api/business/ad-analytics'),

  // Public TV Queue Display
  getPublicQueueBoard: (slug: string) => request<any>(`/api/public-queue/${slug}`),

  // ==========================================
  // OPERATING PARTNER & CRM & COMMISSION API
  // ==========================================
  getPartnerOverview: () => request<OperatingPartnerOverview>('/api/partner/overview'),
  getPartnerBusinesses: () => request<any[]>('/api/partner/businesses'),
  createPartnerBusiness: (data: any) =>
    request<any>('/api/partner/businesses', { method: 'POST', body: JSON.stringify(data) }),
  updatePartnerBusinessStatus: (id: string, status: string, reason?: string) =>
    request<any>(`/api/partner/businesses/${id}/status`, { method: 'POST', body: JSON.stringify({ status, reason }) }),

  // CRM
  getCRMLeads: (params?: { search?: string; status?: string }, signal?: AbortSignal) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.status && params.status !== 'ALL') q.append('status', params.status);
    return request<CRMLead[]>(`/api/partner/crm/leads?${q.toString()}`, { signal });
  },
  createCRMLead: (data: Partial<CRMLead>) =>
    request<CRMLead>('/api/partner/crm/leads', { method: 'POST', body: JSON.stringify(data) }),
  convertCRMLeadToBusiness: (id: string, data: { plan_code?: string; owner_password?: string }) =>
    request<any>(`/api/partner/crm/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),

  // Commissions
  getPartnerCommissions: () =>
    request<{ commissions: PartnerCommission[]; summary: CommissionSummary }>('/api/partner/commissions'),
  settleCommissionPayout: (id: string, payoutNotes?: string) =>
    request<any>(`/api/partner/commissions/${id}/settle`, { method: 'POST', body: JSON.stringify({ payout_notes: payoutNotes }) }),

  // Reports
  getPartnerReports: () => request<PartnerReport[]>('/api/partner/reports'),
  generatePartnerReportDraft: (report_type: 'WEEKLY' | 'MONTHLY') =>
    request<Partial<PartnerReport>>('/api/partner/reports/generate-draft', { method: 'POST', body: JSON.stringify({ report_type }) }),
  submitPartnerReport: (data: any) =>
    request<PartnerReport>('/api/partner/reports', { method: 'POST', body: JSON.stringify(data) }),
  reviewPartnerReport: (id: string, data: { founder_feedback: string }) =>
    request<any>(`/api/partner/reports/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  // Support Tickets
  getPartnerSupportTickets: () => request<SupportTicket[]>('/api/partner/support-tickets'),
  createSupportTicket: (data: Partial<SupportTicket>) =>
    request<SupportTicket>('/api/partner/support-tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateSupportTicketStatus: (id: string, data: { status: string; resolution_notes?: string }) =>
    request<SupportTicket>(`/api/partner/support-tickets/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),

  // Audit
  getPartnerAuditLogs: (params?: { action?: string; target_type?: string }) => {
    const q = new URLSearchParams();
    if (params?.action) q.append('action', params.action);
    if (params?.target_type) q.append('target_type', params.target_type);
    return request<OperatingAuditLog[]>(`/api/partner/audit-logs?${q.toString()}`);
  },
};
