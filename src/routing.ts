/**
 * Minimal History-API router (no external dependency).
 *
 * URL <-> view mapping:
 *   /                 home        (optional ?q=&category=&city=)
 *   /search           search      (catalog without hero, same query params)
 *   /b/:slug          business-detail
 *   /me               customer-dashboard
 *   /business         business-dashboard
 *   /admin            admin-panel
 *   /partner          operating-partner
 *   /for-customers    for-customers
 *   /for-business     for-business
 * Legacy deep link `#business/<slug>` (QR codes) is converted to /b/<slug>.
 */

export type AppView =
  | 'home'
  | 'search'
  | 'business-detail'
  | 'customer-dashboard'
  | 'business-dashboard'
  | 'admin-panel'
  | 'operating-partner'
  | 'for-customers'
  | 'for-business';

export interface CatalogFilters {
  q: string;
  category: string;
  city: string;
}

export interface AppRoute {
  view: AppView;
  slug: string | null;
  filters: CatalogFilters;
}

/** Views that require an authenticated user. */
export const PROTECTED_VIEWS: ReadonlySet<AppView> = new Set<AppView>([
  'customer-dashboard',
  'business-dashboard',
  'admin-panel',
  'operating-partner',
]);

const STATIC_PATHS: Record<string, AppView> = {
  '/': 'home',
  '/search': 'search',
  '/me': 'customer-dashboard',
  '/business': 'business-dashboard',
  '/admin': 'admin-panel',
  '/partner': 'operating-partner',
  '/for-customers': 'for-customers',
  '/for-business': 'for-business',
};

const VIEW_PATHS: Record<Exclude<AppView, 'business-detail'>, string> = {
  home: '/',
  search: '/search',
  'customer-dashboard': '/me',
  'business-dashboard': '/business',
  'admin-panel': '/admin',
  'operating-partner': '/partner',
  'for-customers': '/for-customers',
  'for-business': '/for-business',
};

const EMPTY_FILTERS: CatalogFilters = { q: '', category: '', city: '' };

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseFilters(search: string): CatalogFilters {
  const params = new URLSearchParams(search);
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    city: params.get('city') ?? '',
  };
}

/** Parses the legacy `#business/<slug>` hash, returning the slug or null. */
export function parseLegacyHash(hash: string): string | null {
  if (!hash.startsWith('#business/')) return null;
  const slug = safeDecode(hash.slice('#business/'.length)).split(/[?#/]/)[0].trim();
  return slug || null;
}

export function parseLocation(loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location): AppRoute {
  const legacySlug = parseLegacyHash(loc.hash);
  if (legacySlug) {
    return { view: 'business-detail', slug: legacySlug, filters: EMPTY_FILTERS };
  }

  // Normalise trailing slashes ("/admin/" -> "/admin").
  const path = loc.pathname.length > 1 ? loc.pathname.replace(/\/+$/, '') || '/' : '/';

  const detailMatch = /^\/b\/([^/]+)$/.exec(path);
  if (detailMatch) {
    return { view: 'business-detail', slug: safeDecode(detailMatch[1]), filters: EMPTY_FILTERS };
  }

  const view = STATIC_PATHS[path] ?? 'home';
  const filters = view === 'home' || view === 'search' ? parseFilters(loc.search) : EMPTY_FILTERS;
  return { view, slug: null, filters };
}

export function buildPath(view: AppView, slug: string | null, filters?: Partial<CatalogFilters>): string {
  if (view === 'business-detail') {
    return slug ? `/b/${encodeURIComponent(slug)}` : '/';
  }
  const base = VIEW_PATHS[view];
  if ((view === 'home' || view === 'search') && filters) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    if (filters.city) params.set('city', filters.city);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }
  return base;
}

/** State stored in history entries; `idx` tells whether an in-app "back" is possible. */
export interface HistoryState {
  navbatbor: true;
  idx: number;
}

export function currentHistoryIndex(): number {
  const state = window.history.state as Partial<HistoryState> | null;
  return state && state.navbatbor && typeof state.idx === 'number' ? state.idx : 0;
}
