import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import {
  Shield, Building2,
  Navigation, AlertCircle, CheckCircle2, RefreshCw, LogIn
} from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { useTelegramWebApp } from './hooks/useTelegramWebApp';
import { useToast } from './hooks/useTimedState';
import { api, setStoredToken, isAbortError, hasStoredSession, UNAUTHORIZED_EVENT } from './api';
import { User, Category, City, BusinessItem } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BusinessCard } from './components/BusinessCard';
import { AuthModal } from './components/AuthModal';
import { LegalModal } from './components/LegalModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LandingHero } from './components/LandingHero';
import { BusinessConnectChoice } from './components/BusinessConnectChoice';
import { BusinessApplicationModal } from './components/BusinessApplicationModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageSpinner, OverlaySpinner } from './components/ui/Spinner';
import { useTranslation } from './i18n/LanguageContext';
import { asArray, asNumber } from './utils/safe';
import {
  AppView,
  CatalogFilters,
  PROTECTED_VIEWS,
  buildPath,
  currentHistoryIndex,
  parseLegacyHash,
  parseLocation,
} from './routing';

// Heavy / rarely used screens are code-split so the landing page stays light.
const BusinessDetail = lazy(() => import('./components/BusinessDetail').then((m) => ({ default: m.BusinessDetail })));
const CustomerDashboard = lazy(() => import('./components/CustomerDashboard').then((m) => ({ default: m.CustomerDashboard })));
const BusinessDashboard = lazy(() => import('./components/BusinessDashboard').then((m) => ({ default: m.BusinessDashboard })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const OperatingPartnerDashboard = lazy(() =>
  import('./components/OperatingPartnerDashboard').then((m) => ({ default: m.OperatingPartnerDashboard }))
);
const CustomerBenefitsPage = lazy(() => import('./components/CustomerBenefitsPage').then((m) => ({ default: m.CustomerBenefitsPage })));
const BusinessBenefitsPage = lazy(() => import('./components/BusinessBenefitsPage').then((m) => ({ default: m.BusinessBenefitsPage })));
const QRCodeModal = lazy(() => import('./components/QRCodeModal').then((m) => ({ default: m.QRCodeModal })));
const ScanQRModal = lazy(() => import('./components/ScanQRModal').then((m) => ({ default: m.ScanQRModal })));

const ADMIN_ROLES = ['ADMIN', 'FOUNDER', 'OWNER'];
const BUSINESS_ROLES = ['BUSINESS_OWNER', 'STAFF'];
const PARTNER_ROLES = ['OPERATING_PARTNER', 'ADMIN', 'FOUNDER', 'OWNER', 'SALES_MANAGER', 'BUSINESS_MANAGER'];

interface NavigateOptions {
  slug?: string | null;
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
  /** Scroll to top after navigating (default true). */
  scroll?: boolean;
}

/** "Access restricted" card shown when a protected view is opened without the right role. */
const AccessDenied: React.FC<{ message: string; onHome: () => void; onLogin?: () => void }> = ({ message, onHome, onLogin }) => (
  <div className="max-w-md mx-auto my-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-xs">
    <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
    <h3 className="text-base font-bold text-slate-900">Ruxsat cheklangan</h3>
    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>
    <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
      {onLogin && (
        <button
          onClick={onLogin}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer inline-flex items-center justify-center gap-1.5"
        >
          <LogIn className="w-3.5 h-3.5" />
          Tizimga kirish
        </button>
      )}
      <button
        onClick={onHome}
        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
      >
        Bosh sahifaga qaytish
      </button>
    </div>
  </div>
);

export default function App() {
  const { t, translateCategory } = useTranslation();
  const { isTMA, showBackButton } = useTelegramWebApp();

  // Initial route is parsed once from the URL (supports refresh + deep links).
  const [initialRoute] = useState(() => parseLocation());

  // Navigation & User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [activeView, setActiveViewState] = useState<AppView>(initialRoute.view);
  const [selectedBusinessSlug, setSelectedBusinessSlug] = useState<string | null>(initialRoute.slug);
  const [scanQRModalOpen, setScanQRModalOpen] = useState<boolean>(false);

  // Metadata state
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>(initialRoute.filters.city);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialRoute.filters.category);
  /** Text currently typed in the search box. */
  const [searchQuery, setSearchQuery] = useState<string>(initialRoute.filters.q);
  /** Query actually applied to the catalog (committed on submit). */
  const [appliedQuery, setAppliedQuery] = useState<string>(initialRoute.filters.q);
  const [sortBy, setSortBy] = useState<string>('rating');

  // Businesses list state
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState<boolean>(true);
  const [businessesError, setBusinessesError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  /** Bumped to force a catalog reload with unchanged filters (explicit search / retry). */
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // Active Queue count for logged in customer
  const [activeQueueCount, setActiveQueueCount] = useState<number>(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Geolocation (GPS) State & Hook
  const { 
    coords, 
    isLoading: isGeoLoading, 
    error: geoError, 
    requestLocation, 
  } = useGeolocation();
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [applicationChoiceOpen, setApplicationChoiceOpen] = useState(false);
  const [applicationAfterLogin, setApplicationAfterLogin] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | 'support' | null>(null);
  const [qrModalBusiness, setQrModalBusiness] = useState<BusinessItem | null>(null);
  const { toast } = useToast();

  // Refs mirror state for use inside stable callbacks / global listeners.
  const currentUserRef = useRef<User | null>(currentUser);
  const activeViewRef = useRef<AppView>(activeView);
  const selectedSlugRef = useRef<string | null>(selectedBusinessSlug);
  const filtersRef = useRef<CatalogFilters>({ q: appliedQuery, category: selectedCategory, city: selectedCity });
  useEffect(() => {
    currentUserRef.current = currentUser;
    activeViewRef.current = activeView;
    selectedSlugRef.current = selectedBusinessSlug;
    filtersRef.current = { q: appliedQuery, category: selectedCategory, city: selectedCity };
  });

  // ---------------------------------------------------------------------------
  // Routing (History API)
  // ---------------------------------------------------------------------------

  const navigate = useCallback((view: AppView, opts: NavigateOptions = {}) => {
    const slug = view === 'business-detail' ? opts.slug ?? selectedSlugRef.current : null;
    if (view === 'business-detail' && !slug) return;

    setActiveViewState(view);
    activeViewRef.current = view;
    if (slug) {
      setSelectedBusinessSlug(slug);
      selectedSlugRef.current = slug;
    }

    const path = buildPath(view, slug, view === 'home' || view === 'search' ? filtersRef.current : undefined);
    const current = window.location.pathname + window.location.search;
    const idx = currentHistoryIndex();
    if (opts.replace) {
      window.history.replaceState({ navbatbor: true, idx }, '', path);
    } else if (path !== current || window.location.hash) {
      window.history.pushState({ navbatbor: true, idx: idx + 1 }, '', path);
    }

    if (opts.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  /** In-app back: uses browser history when we have our own previous entry, otherwise goes home. */
  const goBack = useCallback(() => {
    if (currentHistoryIndex() > 0) {
      window.history.back();
    } else {
      navigate('home', { replace: true });
    }
  }, [navigate]);

  /** Legacy setter kept for child components: every view change goes through the router. */
  const setActiveView = useCallback((view: AppView) => navigate(view), [navigate]);

  // Normalise the initial URL (legacy #business/<slug> -> /b/<slug>) and tag the entry.
  useEffect(() => {
    const path = buildPath(initialRoute.view, initialRoute.slug, initialRoute.filters);
    const hasLegacyHash = parseLegacyHash(window.location.hash) !== null;
    const state = window.history.state as { navbatbor?: boolean } | null;
    if (hasLegacyHash || !state?.navbatbor) {
      window.history.replaceState(
        { navbatbor: true, idx: currentHistoryIndex() },
        '',
        hasLegacyHash ? path : window.location.pathname + window.location.search
      );
    }
  }, [initialRoute]);

  // Browser Back / Forward + legacy hash links clicked while the app is open.
  useEffect(() => {
    const onPopState = () => {
      const route = parseLocation();
      setActiveViewState(route.view);
      if (route.slug) setSelectedBusinessSlug(route.slug);
      if (route.view === 'home' || route.view === 'search') {
        const prev = filtersRef.current;
        const { q, category, city } = route.filters;
        if (prev.q !== q || prev.category !== category || prev.city !== city) {
          setSearchQuery(q);
          setAppliedQuery(q);
          setSelectedCategory(category);
          setSelectedCity(city);
          setPage(1);
        }
      }
    };
    const onHashChange = () => {
      const slug = parseLegacyHash(window.location.hash);
      if (slug) navigate('business-detail', { slug, replace: true });
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [navigate]);

  // Keep ?q=&category=&city= in sync on catalog views (replace, not push, to avoid history spam).
  useEffect(() => {
    if (activeView !== 'home' && activeView !== 'search') return;
    const path = buildPath(activeView, null, { q: appliedQuery, category: selectedCategory, city: selectedCity });
    if (path !== window.location.pathname + window.location.search) {
      window.history.replaceState({ navbatbor: true, idx: currentHistoryIndex() }, '', path);
    }
  }, [activeView, appliedQuery, selectedCategory, selectedCity]);

  // Native Telegram BackButton mirrors the in-app back behaviour.
  useEffect(() => {
    if (!isTMA || activeView === 'home') return;
    return showBackButton(goBack);
  }, [isTMA, activeView, showBackButton, goBack]);

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  const openAuth = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  }, []);

  // Initial Load: User, Categories, Cities
  useEffect(() => {
    let cancelled = false;
    if (hasStoredSession()) {
      api
        .getMe()
        .then((res) => {
          if (!cancelled && res?.user) setCurrentUser(res.user);
        })
        .catch(() => {
          // Guest user is fine
        })
        .finally(() => {
          if (!cancelled) setAuthChecked(true);
        });
    } else {
      // No stored credentials: skip the guaranteed-401 /api/auth/me round trip.
      setAuthChecked(true);
    }

    // Load categories & cities independently so one failure does not hide the other.
    api
      .getCategories()
      .then((list) => !cancelled && setCategories(asArray<Category>(list)))
      .catch((err) => console.error('Kategoriyalarni yuklashda xatolik:', err));
    api
      .getCities()
      .then((list) => !cancelled && setCities(asArray<City>(list)))
      .catch((err) => console.error('Shaharlarni yuklashda xatolik:', err));

    return () => {
      cancelled = true;
    };
  }, []);

  // Session expired (refresh token rejected) -> drop user, ask to log in again.
  useEffect(() => {
    const onUnauthorized = () => {
      const wasLoggedIn = currentUserRef.current !== null;
      const onProtectedView = PROTECTED_VIEWS.has(activeViewRef.current);
      setCurrentUser(null);
      if (onProtectedView) navigate('home', { replace: true });
      if (wasLoggedIn || onProtectedView) openAuth('login');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [navigate, openAuth]);

  // Priority ordering for category chips: "Tibbiyot" placed at the very beginning next to "Barchasi" and "Avtoservis"
  const orderedCategories = useMemo(() => {
    const list = [...categories];
    // Guarantee Tibbiyot is included even before API returns
    if (!list.some((c) => (c.slug || '').toLowerCase() === 'tibbiyot' || c.id === 'cat-medicine')) {
      list.unshift({
        id: 'cat-medicine',
        name: 'Tibbiyot',
        slug: 'tibbiyot',
        icon: 'Stethoscope'
      });
    }
    const priority = ['tibbiyot', 'avtoservis', 'stomatologiya', 'gozallik', 'sartaroshxona', 'oquv-markazi', 'sport', 'konsultatsiya', 'boshqa'];
    return list.sort((a, b) => {
      const slugA = (a.slug || '').toLowerCase();
      const slugB = (b.slug || '').toLowerCase();
      const idxA = priority.indexOf(slugA);
      const idxB = priority.indexOf(slugB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [categories]);

  const getCategoryIcon = (slugOrName: string) => {
    const s = (slugOrName || '').toLowerCase();
    if (s.includes('tibbiyot') || s.includes('medicine')) return '🩺';
    if (s.includes('avtoservis') || s.includes('auto')) return '🚗';
    if (s.includes('stomatologiya') || s.includes('dent')) return '🦷';
    if (s.includes('gozallik') || s.includes('beauty')) return '✨';
    if (s.includes('sartaroshxona') || s.includes('barber')) return '✂️';
    if (s.includes('oquv') || s.includes('education')) return '🎓';
    if (s.includes('sport')) return '🏋️';
    if (s.includes('konsultatsiya') || s.includes('consult')) return '💼';
    return '🏢';
  };

  // Check active queue and favorites for customer
  useEffect(() => {
    if (currentUser && currentUser.role === 'CUSTOMER') {
      let cancelled = false;
      api
        .getMyActiveQueue()
        .then((res) => {
          if (!cancelled) setActiveQueueCount(res?.activeQueue ? 1 : 0);
        })
        .catch(() => !cancelled && setActiveQueueCount(0));

      api
        .getCustomerFavoriteIds()
        .then((ids) => !cancelled && setFavoriteIds(asArray<string>(ids)))
        .catch(() => !cancelled && setFavoriteIds([]));
      return () => {
        cancelled = true;
      };
    }
    setActiveQueueCount(0);
    setFavoriteIds([]);
  }, [currentUser]);

  const handleToggleFavorite = async (bizId: string) => {
    if (!currentUser) {
      openAuth('login');
      return;
    }
    try {
      const res = await api.toggleCustomerFavorite(bizId);
      if (res.isSaved) {
        setFavoriteIds((prev) => (prev.includes(bizId) ? prev : [...prev, bizId]));
      } else {
        setFavoriteIds((prev) => prev.filter((id) => id !== bizId));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Catalog loading: ONE effect drives every fetch; stale responses are aborted.
  // ---------------------------------------------------------------------------

  const catalogVisible = activeView === 'home' || activeView === 'search';
  const lastCatalogKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!catalogVisible) return;
    const params = {
      q: appliedQuery,
      category: selectedCategory,
      city: selectedCity,
      sort: sortBy,
      page,
      limit: 12,
      lat: coords?.lat,
      lng: coords?.lng,
    };
    const key = JSON.stringify({ ...params, reloadNonce });
    // Returning to the catalog with unchanged params reuses the already loaded page.
    if (key === lastCatalogKeyRef.current) return;

    const controller = new AbortController();
    setLoadingBusinesses(true);
    setBusinessesError(null);

    api
      .getBusinesses(params, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        lastCatalogKeyRef.current = key;
        setBusinesses(asArray<BusinessItem>(res?.items));
        setTotalPages(Math.max(1, asNumber(res?.totalPages, 1)));
        setTotalCount(asNumber(res?.total));
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        console.error('Error loading businesses:', err);
        setBusinessesError(err?.message || 'Bizneslarni yuklashda xatolik');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBusinesses(false);
      });

    return () => controller.abort();
  }, [catalogVisible, appliedQuery, selectedCategory, selectedCity, sortBy, page, coords?.lat, coords?.lng, reloadNonce]);

  const reloadBusinesses = useCallback(() => setReloadNonce((n) => n + 1), []);

  const scrollToCatalog = () => {
    // Wait a frame so the catalog exists when navigating from another view.
    requestAnimationFrame(() => {
      const el = document.getElementById('catalog-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const handleGpsSearch = async () => {
    if (coords) {
      setSortBy('nearby');
      setPage(1);
      setGpsNotice('Joylashuvingiz bo‘yicha eng yaqin klinika va salonlar saralandi');
      scrollToCatalog();
      return;
    }

    await requestLocation(() => {
      setSortBy('nearby');
      setPage(1);
      setGpsNotice('Joylashuv aniqlandi: Sizga eng yaqin klinika va salonlar masofa bo‘yicha saralandi');
      scrollToCatalog();
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // All three updates are batched into a single render -> exactly one fetch with page=1.
    setAppliedQuery(searchQuery.trim());
    setPage(1);
    setReloadNonce((n) => n + 1);
    if (activeView !== 'search' && activeView !== 'home') {
      navigate('search');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setAppliedQuery('');
    setSelectedCategory('');
    setSelectedCity('');
    setPage(1);
  };

  const handleSelectBusiness = useCallback(
    (biz: BusinessItem) => {
      if (!biz?.slug) return;
      navigate('business-detail', { slug: biz.slug });
    },
    [navigate]
  );

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Server-side blacklist is best effort; local tokens are cleared regardless.
    }
    setStoredToken(null);
    setCurrentUser(null);
    navigate('home');
  };

  const closeAllModals = () => {
    setApplicationChoiceOpen(false);
    setApplicationOpen(false);
    setAuthModalOpen(false);
    setLegalModalType(null);
    setQrModalBusiness(null);
    setScanQRModalOpen(false);
  };

  const openBusinessApplication = useCallback(() => {
    setApplicationChoiceOpen(true);
  }, []);
  const openWebsiteApplication = useCallback(() => {
    setApplicationChoiceOpen(false);
    if (!currentUser) {
      setApplicationAfterLogin(true);
      setAuthInitialMode('register');
      setAuthModalOpen(true);
      return;
    }
    setApplicationOpen(true);
  }, [currentUser]);

  const isProtectedView = PROTECTED_VIEWS.has(activeView);
  const waitingForAuth = isProtectedView && !authChecked;
  const role = currentUser?.role ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <ErrorBoundary compact onReset={() => navigate('home')}>
        <Navbar
          user={currentUser}
          cities={cities}
          selectedCity={selectedCity}
          onSelectCity={(cId) => {
            setSelectedCity(cId);
            setPage(1);
          }}
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenAuth={(mode = 'login') => openAuth(mode)}
          onLogout={handleLogout}
          activeQueueCount={activeQueueCount}
          onOpenBusinessOnboarding={openBusinessApplication}
          onOpenScanQR={() => setScanQRModalOpen(true)}
        />
      </ErrorBoundary>

      {/* Main View Switcher */}
      <main className="flex-1 pb-16 md:pb-12">
        <ErrorBoundary key={`${activeView}:${selectedBusinessSlug ?? ''}`} onGoHome={() => navigate('home')}>
        <Suspense fallback={<PageSpinner />}>
        {/* VIEW: HOME & SEARCH */}
        {(activeView === 'home' || activeView === 'search') && (
          <div>
            {/* Hero Search Section - Compact, Focused & 2-Second Visual Understanding */}
            {activeView === 'home' && (
              <LandingHero
                cities={cities} city={selectedCity} query={searchQuery}
                onCity={(id) => { setSelectedCity(id); setPage(1); }} onQuery={setSearchQuery}
                onSearch={handleSearchSubmit} onGps={handleGpsSearch} onScan={() => setScanQRModalOpen(true)}
                gpsLoading={isGeoLoading} gpsActive={Boolean(coords && sortBy === 'nearby')}
                notice={gpsNotice} error={geoError}
                onConnectBusiness={openBusinessApplication}
              />
            )}

            {/* Sticky Category Quick Filter Bar */}
            <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-2xs">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  id="cat-pill-all"
                  onClick={() => {
                    setSelectedCategory('');
                    setPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === ''
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>⚡</span>
                  <span>{t('cat_all')}</span>
                </button>
                {orderedCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.id || selectedCategory === cat.slug;
                  const isFeatured = cat.slug === 'tibbiyot' || cat.slug === 'avtoservis';
                  return (
                    <button
                      key={cat.id}
                      id={`cat-pill-${cat.slug}`}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-600/30'
                          : isFeatured
                          ? 'bg-white border border-slate-300 text-slate-900 hover:border-blue-400 hover:bg-slate-50 font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="text-sm leading-none">{getCategoryIcon(cat.slug || cat.name)}</span>
                      <span>{translateCategory(cat.slug || cat.name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Siz uchun xizmatlar */}
            <section id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
              {/* Catalog header & sorting */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Siz uchun xizmatlar
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {selectedCategory
                      ? `${translateCategory(categories.find((c) => c.id === selectedCategory)?.slug || categories.find((c) => c.id === selectedCategory)?.name || '')} bo‘yicha topildi: ${totalCount}`
                      : `Topildi: ${totalCount} ta muassasa`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    id="quick-gps-filter-btn"
                    onClick={handleGpsSearch}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      coords && sortBy === 'nearby'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Navigation className={`w-3.5 h-3.5 ${coords && sortBy === 'nearby' ? 'text-white fill-white' : 'text-blue-600'}`} />
                    <span>{isGeoLoading ? t('detecting_gps') : coords && sortBy === 'nearby' ? t('near_me_active') : t('near_me')}</span>
                  </button>

                  <span className="text-xs text-slate-500 ml-1">{t('sort_label')}</span>
                  <select
                    id="catalog-sort-select"
                    aria-label="Xizmatlarni saralash"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPage(1);
                      if (e.target.value === 'nearby' && !coords) {
                        handleGpsSearch();
                      }
                    }}
                    className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="rating">{t('sort_rating')}</option>
                    <option value="nearby">{t('sort_nearby')}</option>
                    <option value="reviews">{t('sort_reviews')}</option>
                    <option value="newest">{t('sort_newest')}</option>
                  </select>
                </div>
              </div>

              {/* Active GPS Info Banner */}
              {coords && sortBy === 'nearby' && (
                <div className="mb-6 p-3.5 bg-blue-50/90 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Navigation className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{t('near_me_active')}</p>
                      <p className="text-slate-600 text-[11px] mt-0.5">{t('distance_km', { km: 0 })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={handleGpsSearch}
                      title="GPS"
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg border border-slate-200 text-[11px] transition flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeoLoading ? 'animate-spin' : ''}`} />
                      <span>{t('apply')}</span>
                    </button>
                    <button
                      id="cancel-gps-sort-btn"
                      onClick={() => {
                        setSortBy('rating');
                        setPage(1);
                        setGpsNotice(null);
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200 text-[11px] transition cursor-pointer"
                    >
                      {t('sort_rating')}
                    </button>
                  </div>
                </div>
              )}

              {/* Businesses Grid */}
              {loadingBusinesses ? (
                <div className="py-20 text-center text-xs text-slate-400" role="status" aria-live="polite">
                  {t('loading')}
                </div>
              ) : businessesError ? (
                <div className="py-14 text-center border border-rose-200 rounded-2xl bg-rose-50/60 p-8" role="alert">
                  <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">Bizneslarni yuklab bo‘lmadi</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{businessesError}</p>
                  <button
                    onClick={reloadBusinesses}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Qayta urinish
                  </button>
                </div>
              ) : businesses.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white p-8">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">{t('no_results')}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {t('no_results_desc')}
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    {t('reset_filters')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {businesses.map((biz) => (
                    <BusinessCard
                      key={biz.id}
                      business={biz}
                      onSelect={handleSelectBusiness}
                      onOpenQR={(b) => setQrModalBusiness(b)}
                      isFavorite={favoriteIds.includes(biz.id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                  >
                    Oldingi
                  </button>
                  <span className="text-xs font-bold text-slate-600 px-3">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => {
                      setPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                  >
                    Keyingi
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* VIEW: BUSINESS DETAIL */}
        {activeView === 'business-detail' && selectedBusinessSlug && (
          <BusinessDetail
            slug={selectedBusinessSlug}
            currentUser={currentUser}
            userCoords={coords}
            onBack={goBack}
            onOpenAuth={() => openAuth('login')}
            onBookingSuccess={() => navigate('customer-dashboard')}
            onGoToBookings={() => navigate('customer-dashboard')}
          />
        )}

        {/* Protected views wait for the initial /api/auth/me check before deciding. */}
        {waitingForAuth && <PageSpinner label="Sessiya tekshirilmoqda..." />}

        {/* VIEW: CUSTOMER DASHBOARD */}
        {activeView === 'customer-dashboard' && authChecked && (
          currentUser ? (
            <CustomerDashboard
              currentUser={currentUser}
              onExploreBusinesses={() => navigate('home')}
              onSelectBusiness={handleSelectBusiness}
              onUserUpdate={(updated) => setCurrentUser(updated)}
            />
          ) : (
            <AccessDenied
              message="Bronlaringiz va navbatlaringizni ko‘rish uchun tizimga kiring."
              onHome={() => navigate('home')}
              onLogin={() => openAuth('login')}
            />
          )
        )}

        {/* VIEW: BUSINESS DASHBOARD */}
        {activeView === 'business-dashboard' && authChecked && (
          currentUser && BUSINESS_ROLES.includes(role) ? (
            <BusinessDashboard
              onOpenOnboarding={openBusinessApplication}
            />
          ) : (
            <AccessDenied
              message="Ushbu boshqaruv paneliga faqat platforma ma’muriyati tomonidan tasdiqlangan biznes egalari va xodimlar kirishi mumkin."
              onHome={() => navigate('home')}
              onLogin={currentUser ? undefined : () => openAuth('login')}
            />
          )
        )}

        {/* VIEW: ADMIN PANEL */}
        {activeView === 'admin-panel' && authChecked && (
          currentUser && ADMIN_ROLES.includes(role) ? (
            <AdminPanel onSwitchToPartner={() => navigate('operating-partner')} />
          ) : (
            <AccessDenied
              message="Super administrator paneliga faqat bosh ma’muriyat (Founder) kirish huquqiga ega."
              onHome={() => navigate('home')}
              onLogin={currentUser ? undefined : () => openAuth('login')}
            />
          )
        )}

        {/* VIEW: OPERATING PARTNER DASHBOARD */}
        {activeView === 'operating-partner' && authChecked && (
          currentUser && PARTNER_ROLES.includes(role) ? (
            <OperatingPartnerDashboard
              currentUser={currentUser}
              onSwitchToAdmin={() => navigate('admin-panel')}
            />
          ) : (
            <AccessDenied
              message="Operating Partner boshqaruv paneliga faqat tayinlangan hududiy operatsion boshqaruvchilar va Founder kirishi mumkin."
              onHome={() => navigate('home')}
              onLogin={currentUser ? undefined : () => openAuth('login')}
            />
          )
        )}

        {/* VIEW: FOR CUSTOMERS */}
        {activeView === 'for-customers' && (
          <CustomerBenefitsPage
            onBack={goBack}
            onExplore={() => {
              navigate('home', { scroll: false });
              setPage(1);
              scrollToCatalog();
            }}
          />
        )}

        {/* VIEW: FOR BUSINESS */}
        {activeView === 'for-business' && (
          <BusinessBenefitsPage
            onBack={goBack}
            onOpenOnboarding={openBusinessApplication}
          />
        )}
        </Suspense>
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <Footer
        onOpenLegal={(type) => setLegalModalType(type)}
        onOpenBusinessOnboarding={openBusinessApplication}
        onNavigate={setActiveView}
      />

      {/* Global toast (e.g. Telegram bot connection errors) */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[90] px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50/95 text-emerald-800 border-emerald-300' : 'bg-rose-50/95 text-rose-800 border-rose-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* MODALS */}
      <ErrorBoundary compact onReset={closeAllModals}>
      <Suspense fallback={<OverlaySpinner />}>
      {authModalOpen && (
        <AuthModal
          initialMode={authInitialMode}
          onClose={() => { setAuthModalOpen(false); setApplicationAfterLogin(false); }}
          onSuccess={(u) => {
            setCurrentUser(u);
            setAuthChecked(true);
            setAuthModalOpen(false);
            if (applicationAfterLogin) {
              setApplicationAfterLogin(false);
              setApplicationOpen(true);
              return;
            }
            // Stay on a public page the user was browsing (e.g. a business they want to book).
            if (activeViewRef.current === 'business-detail') return;
            if (BUSINESS_ROLES.includes(u.role)) navigate('business-dashboard');
            else if (u.role === 'OPERATING_PARTNER' || u.role === 'SALES_MANAGER' || u.role === 'BUSINESS_MANAGER' || u.role === 'SUPPORT') navigate('operating-partner');
            else if (ADMIN_ROLES.includes(u.role)) navigate('admin-panel');
            else navigate('customer-dashboard');
          }}
        />
      )}

      {legalModalType && (
        <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />
      )}
      {applicationOpen && currentUser && (
        <BusinessApplicationModal user={currentUser} categories={categories} cities={cities} onClose={() => setApplicationOpen(false)} />
      )}
      {applicationChoiceOpen && <BusinessConnectChoice onClose={() => setApplicationChoiceOpen(false)} onWebsite={openWebsiteApplication} />}

      {qrModalBusiness && (
        <QRCodeModal
          business={qrModalBusiness}
          onClose={() => setQrModalBusiness(null)}
        />
      )}

      {/* Camera QR Scanner Modal */}
      {scanQRModalOpen && (
        <ScanQRModal
          isOpen={scanQRModalOpen}
          onClose={() => setScanQRModalOpen(false)}
          onSelectBusiness={handleSelectBusiness}
        />
      )}
      </Suspense>
      </ErrorBoundary>

      {/* Persistent Mobile Bottom Navigation (Smartphones & Small Tablets) */}
      <MobileBottomNav
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        onOpenAuth={() => openAuth('login')}
        onOpenScanQR={() => setScanQRModalOpen(true)}
      />
    </div>
  );
}
