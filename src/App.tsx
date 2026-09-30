import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Star, Calendar, 
  Sparkles, Shield, ShieldCheck, ArrowRight, CheckCircle, Clock, Building2, QrCode,
  Navigation, AlertCircle, RefreshCw
} from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { api, setStoredToken } from './api';
import { User, Category, City, BusinessItem } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BusinessCard } from './components/BusinessCard';
import { BusinessDetail } from './components/BusinessDetail';
import { CustomerDashboard } from './components/CustomerDashboard';
import { BusinessDashboard } from './components/BusinessDashboard';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { BusinessOnboardingModal } from './components/BusinessOnboardingModal';
import { LegalModal } from './components/LegalModal';
import { QRCodeModal } from './components/QRCodeModal';
import { ScanQRModal } from './components/ScanQRModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HeroLiveWidget } from './components/HeroLiveWidget';
import { OperatingPartnerDashboard } from './components/OperatingPartnerDashboard';
import { CustomerBenefitsPage } from './components/CustomerBenefitsPage';
import { BusinessBenefitsPage } from './components/BusinessBenefitsPage';
import { useTranslation } from './i18n/LanguageContext';

export default function App() {
  const { t, translateCategory, translateCity } = useTranslation();

  // Navigation & User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<
    'home' | 'search' | 'business-detail' | 'customer-dashboard' | 'business-dashboard' | 'admin-panel' | 'operating-partner' | 'for-customers' | 'for-business'
  >('home');
  const [selectedBusinessSlug, setSelectedBusinessSlug] = useState<string | null>(null);
  const [scanQRModalOpen, setScanQRModalOpen] = useState<boolean>(false);

  // Live Marketplace Stats
  const [stats, setStats] = useState({
    businesses: 50,
    customers: 15000,
    queues: 45000,
    bookings: 12000,
  });

  useEffect(() => {
    api.getPublicStats()
      .then((res: any) => {
        if (res && res.businesses) {
          setStats(res);
        }
      })
      .catch(() => {});
  }, []);

  // Metadata state
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('rating');

  // Businesses list state
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Active Queue count for logged in customer
  const [activeQueueCount, setActiveQueueCount] = useState<number>(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Geolocation (GPS) State & Hook
  const { 
    coords, 
    isLoading: isGeoLoading, 
    error: geoError, 
    requestLocation, 
    clearLocation 
  } = useGeolocation();
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [onboardModalOpen, setOnboardModalOpen] = useState<boolean>(false);
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | 'support' | null>(null);
  const [qrModalBusiness, setQrModalBusiness] = useState<BusinessItem | null>(null);

  // Initial Load: User, Categories, Cities
  useEffect(() => {
    // Check current auth
    api
      .getMe()
      .then((res) => {
        if (res?.user) {
          setCurrentUser(res.user);
        }
      })
      .catch(() => {
        // Guest user is fine
      });

    // Load categories & cities
    Promise.all([api.getCategories(), api.getCities()])
      .then(([catList, cityList]) => {
        setCategories(catList);
        setCities(cityList);
      })
      .catch((err) => console.error('Meta load error:', err));
  }, []);

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
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  const getCategoryIcon = (slugOrName: string) => {
    const s = slugOrName.toLowerCase();
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
      api
        .getMyActiveQueue()
        .then((res) => {
          setActiveQueueCount(res?.activeQueue ? 1 : 0);
        })
        .catch(() => setActiveQueueCount(0));

      api
        .getCustomerFavoriteIds()
        .then((ids) => setFavoriteIds(ids || []))
        .catch(() => setFavoriteIds([]));
    } else {
      setActiveQueueCount(0);
      setFavoriteIds([]);
    }
  }, [currentUser]);

  const handleToggleFavorite = async (bizId: string) => {
    if (!currentUser) {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
      return;
    }
    try {
      const res = await api.toggleCustomerFavorite(bizId);
      if (res.isSaved) {
        setFavoriteIds((prev) => [...prev, bizId]);
      } else {
        setFavoriteIds((prev) => prev.filter((id) => id !== bizId));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Load businesses when filters or coordinates change
  const loadBusinesses = () => {
    setLoadingBusinesses(true);
    api
      .getBusinesses({
        q: searchQuery,
        category: selectedCategory,
        city: selectedCity,
        sort: sortBy,
        page,
        limit: 12,
        lat: coords?.lat,
        lng: coords?.lng,
      })
      .then((res) => {
        setBusinesses(res.items);
        setTotalPages(res.totalPages);
        setTotalCount(res.total);
      })
      .catch((err) => {
        console.error('Error loading businesses:', err);
      })
      .finally(() => {
        setLoadingBusinesses(false);
      });
  };

  useEffect(() => {
    loadBusinesses();
  }, [selectedCategory, selectedCity, sortBy, page, coords]);

  const handleGpsSearch = async () => {
    if (coords) {
      setSortBy('nearby');
      setPage(1);
      setGpsNotice('Joylashuvingiz bo‘yicha eng yaqin klinika va salonlar saralandi');
      const el = document.getElementById('catalog-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    await requestLocation(() => {
      setSortBy('nearby');
      setPage(1);
      setGpsNotice('Joylashuv aniqlandi: Sizga eng yaqin klinika va salonlar masofa bo‘yicha saralandi');
      const el = document.getElementById('catalog-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadBusinesses();
    if (activeView !== 'search' && activeView !== 'home') {
      setActiveView('search');
    }
  };

  const handleSelectBusiness = (biz: BusinessItem) => {
    setSelectedBusinessSlug(biz.slug);
    setActiveView('business-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {}
    setStoredToken(null);
    setCurrentUser(null);
    setActiveView('home');
  };

  // URL Hash routing listener (for direct links or QR codes)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#business/')) {
        const slug = hash.replace('#business/', '');
        setSelectedBusinessSlug(slug);
        setActiveView('business-detail');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        user={currentUser}
        cities={cities}
        selectedCity={selectedCity}
        onSelectCity={(cId) => {
          setSelectedCity(cId);
          setPage(1);
        }}
        activeView={activeView}
        setActiveView={(v) => {
          setActiveView(v);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAuth={(mode = 'login') => {
          setAuthInitialMode(mode);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        activeQueueCount={activeQueueCount}
        onOpenBusinessOnboarding={() => setOnboardModalOpen(true)}
        onOpenScanQR={() => setScanQRModalOpen(true)}
      />

      {/* Main View Switcher */}
      <main className="flex-1 pb-16 md:pb-12">
        {/* VIEW: HOME & SEARCH */}
        {(activeView === 'home' || activeView === 'search') && (
          <div>
            {/* Hero Search Section - Compact, Focused & 2-Second Visual Understanding */}
            {activeView === 'home' && (
              <section className="relative bg-slate-900 bg-gradient-to-b from-[#0a0f1d] via-[#0f172a] to-[#0a0f1d] text-white pt-5 pb-6 px-3 sm:pt-8 sm:pb-10 sm:px-6 overflow-hidden border-b border-slate-800/80">
                {/* Subtle Dot Grid Background Pattern */}
                <div 
                  className="absolute inset-0 opacity-[0.08] pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(#94a3b8 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                  }}
                />

                {/* Subtle soft ambient light glow behind search */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-40 bg-blue-600/15 blur-3xl pointer-events-none rounded-full" />

                <div className="relative max-w-3xl mx-auto text-center space-y-3 sm:space-y-3.5">
                  {/* Visual Micro-Widget (Live Queue & Time Booking demo) */}
                  <div className="flex justify-center">
                    <HeroLiveWidget />
                  </div>

                  {/* Hero: Kutib o‘tirmang. Navbatingizni oldindan oling. */}
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                    Kutib o‘tirmang.
                    <span className="block text-blue-400 font-extrabold text-xl sm:text-3xl mt-1">
                      Navbatingizni oldindan oling.
                    </span>
                  </h1>

                  {/* Single short, crisp subtitle */}
                  <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto font-normal">
                    Klinika, salon, avtoservis va ta’lim markazlariga masofadan navbat oling yoki aniq vaqtni bron qiling.
                  </p>

                  {/* Katta qidiruv: Biznes yoki xizmat qidirish */}
                  <form
                    onSubmit={handleSearchSubmit}
                    className="max-w-2xl mx-auto bg-white p-1.5 sm:p-2 rounded-2xl shadow-xl shadow-slate-950/40 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 border border-slate-200 mt-2 transition hover:border-slate-300"
                  >
                    <div className="flex-1 flex items-center gap-2.5 px-3 py-2 w-full text-slate-800">
                      <Search className="w-5 h-5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        id="main-search-input"
                        placeholder="Biznes yoki xizmat qidirish..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-sm font-medium placeholder:text-slate-400 focus:outline-none bg-transparent"
                      />
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    {/* City Select */}
                    <div className="w-full sm:w-44 px-3 py-2 text-slate-700 flex items-center gap-2 bg-slate-50 sm:bg-transparent rounded-xl sm:rounded-none">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                      {cities.length <= 1 ? (
                        <div className="w-full text-xs font-semibold text-slate-800 flex items-center">
                          <span>{cities[0] ? translateCity(cities[0].name) : 'Qarshi'}</span>
                        </div>
                      ) : (
                        <select
                          id="hero-city-select"
                          value={selectedCity}
                          onChange={(e) => setSelectedCity(e.target.value)}
                          className="w-full text-xs font-semibold bg-transparent focus:outline-none cursor-pointer text-slate-800"
                        >
                          <option value="">{t('select_city')} ({t('cat_all')})</option>
                          {cities.map((c) => (
                            <option key={c.id} value={c.id}>
                              {translateCity(c.name)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Geolocation GPS Action Button */}
                    <button
                      type="button"
                      id="hero-gps-btn"
                      onClick={handleGpsSearch}
                      title="GPS"
                      className={`w-full sm:w-auto px-4 py-2.5 sm:py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 active:scale-[0.98] cursor-pointer ${
                        coords && sortBy === 'nearby'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Navigation className={`w-3.5 h-3.5 ${coords && sortBy === 'nearby' ? 'text-blue-600 fill-blue-600' : 'text-slate-500'}`} />
                      <span>{isGeoLoading ? t('detecting_gps') : coords && sortBy === 'nearby' ? t('near_me_active') : t('near_me')}</span>
                    </button>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        id="hero-scan-qr-btn"
                        onClick={() => setScanQRModalOpen(true)}
                        className="flex-1 sm:flex-initial px-3.5 py-2.5 sm:py-3 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                        title={t('scan_qr_desc')}
                      >
                        <QrCode className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="whitespace-nowrap">{t('scan_qr')}</span>
                      </button>

                      {/* Main 'Navbat olish' CTA */}
                      <button
                        type="submit"
                        id="hero-search-btn"
                        className="flex-1 sm:flex-initial px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-xl transition shadow-md shadow-blue-500/25 active:scale-[0.98] cursor-pointer whitespace-nowrap"
                      >
                        {t('take_queue') || 'Navbat olish'}
                      </button>
                    </div>
                  </form>

                  {/* Dynamic GPS Feedback Notice */}
                  {gpsNotice && (
                    <div className="pt-1 flex items-center justify-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/80 backdrop-blur-md border border-blue-400/40 rounded-full text-[11px] sm:text-xs text-blue-100 shadow-sm animate-in fade-in">
                        <Navigation className="w-3 h-3 text-blue-300 fill-blue-300" />
                        <span>{gpsNotice}</span>
                        <button onClick={() => setGpsNotice(null)} className="text-white/60 hover:text-white font-bold ml-1 text-xs cursor-pointer">✕</button>
                      </div>
                    </div>
                  )}

                  {geoError && (
                    <div className="pt-1 flex items-center justify-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-950/80 backdrop-blur-md border border-amber-400/50 rounded-full text-[11px] sm:text-xs text-amber-200 shadow-sm animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span>{geoError}</span>
                        <button onClick={clearLocation} className="text-amber-200 hover:text-white font-bold ml-1 text-xs cursor-pointer">✕</button>
                      </div>
                    </div>
                  )}

                  {/* Single Honest Trust Signal */}
                  <div className="pt-0.5 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{t('hero_badge')}</span>
                  </div>
                </div>
              </section>
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

            {/* Yaqin atrofdagi bizneslar */}
            <section id="catalog-section" className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
              {/* Catalog header & sorting */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Yaqin atrofdagi bizneslar
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
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
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
                <div className="py-20 text-center text-xs text-slate-400">
                  {t('loading')}
                </div>
              ) : businesses.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white p-8">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">{t('no_results')}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {t('no_results_desc')}
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('');
                      setSelectedCity('');
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    {t('reset_filters')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            onBack={() => setActiveView('home')}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            onBookingSuccess={(booking) => {
              // Switch to customer dashboard to view bookings
              setActiveView('customer-dashboard');
            }}
            onGoToBookings={() => {
              setActiveView('customer-dashboard');
            }}
          />
        )}

        {/* VIEW: CUSTOMER DASHBOARD */}
        {activeView === 'customer-dashboard' && currentUser && (
          <CustomerDashboard
            currentUser={currentUser}
            onExploreBusinesses={() => setActiveView('home')}
            onSelectBusiness={handleSelectBusiness}
            onUserUpdate={(updated) => setCurrentUser(updated)}
          />
        )}

        {/* VIEW: BUSINESS DASHBOARD */}
        {activeView === 'business-dashboard' && (
          currentUser && (currentUser.role === 'BUSINESS_OWNER' || currentUser.role === 'STAFF') ? (
            <BusinessDashboard
              currentUser={currentUser}
              onOpenOnboarding={() => setOnboardModalOpen(true)}
            />
          ) : (
            <div className="max-w-md mx-auto my-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-xs">
              <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Ruxsat cheklangan</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ushbu boshqaruv paneliga faqat platforma ma’muriyati tomonidan tasdiqlangan biznes egalari va xodimlar kirishi mumkin.
              </p>
              <button
                onClick={() => setActiveView('home')}
                className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
              >
                Bosh sahifaga qaytish
              </button>
            </div>
          )
        )}

        {/* VIEW: ADMIN PANEL */}
        {activeView === 'admin-panel' && (
          currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'FOUNDER' || currentUser.role === 'OWNER') ? (
            <AdminPanel onSwitchToPartner={() => setActiveView('operating-partner')} />
          ) : (
            <div className="max-w-md mx-auto my-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-xs">
              <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Ruxsat cheklangan</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Super administrator paneliga faqat bosh ma’muriyat (Founder) kirish huquqiga ega.
              </p>
              <button
                onClick={() => setActiveView('home')}
                className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
              >
                Bosh sahifaga qaytish
              </button>
            </div>
          )
        )}

        {/* VIEW: OPERATING PARTNER DASHBOARD */}
        {activeView === 'operating-partner' && (
          currentUser && (currentUser.role === 'OPERATING_PARTNER' || currentUser.role === 'ADMIN' || currentUser.role === 'FOUNDER' || currentUser.role === 'OWNER' || currentUser.role === 'SALES_MANAGER' || currentUser.role === 'BUSINESS_MANAGER') ? (
            <OperatingPartnerDashboard
              currentUser={currentUser}
              onSelectBusiness={handleSelectBusiness}
              onSwitchToAdmin={() => setActiveView('admin-panel')}
            />
          ) : (
            <div className="max-w-md mx-auto my-20 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-xs">
              <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Ruxsat cheklangan</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Operating Partner boshqaruv paneliga faqat tayinlangan hududiy operatsion boshqaruvchilar va Founder kirishi mumkin.
              </p>
              <button
                onClick={() => setActiveView('home')}
                className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
              >
                Bosh sahifaga qaytish
              </button>
            </div>
          )
        )}

        {/* VIEW: FOR CUSTOMERS */}
        {activeView === 'for-customers' && (
          <CustomerBenefitsPage
            onBack={() => {
              setActiveView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onExplore={() => {
              setActiveView('home');
              setPage(1);
              const el = document.getElementById('catalog-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
          />
        )}

        {/* VIEW: FOR BUSINESS */}
        {activeView === 'for-business' && (
          <BusinessBenefitsPage
            onBack={() => {
              setActiveView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenOnboarding={() => setOnboardModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        onOpenLegal={(type) => setLegalModalType(type)}
        onOpenBusinessOnboarding={() => {
          setOnboardModalOpen(true);
        }}
        onNavigate={(view) => {
          setActiveView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSelectCategory={(slugOrId) => {
          const matched = categories.find((c) => c.slug === slugOrId || c.id === slugOrId);
          setSelectedCategory(matched ? matched.id : slugOrId);
          setActiveView('home');
          setPage(1);
          const el = document.getElementById('catalog-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
          else window.scrollTo({ top: 400, behavior: 'smooth' });
        }}
      />

      {/* MODALS */}
      {authModalOpen && (
        <AuthModal
          initialMode={authInitialMode}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={(u) => {
            setCurrentUser(u);
            setAuthModalOpen(false);
            if (u.role === 'BUSINESS_OWNER' || u.role === 'STAFF') setActiveView('business-dashboard');
            else if (u.role === 'OPERATING_PARTNER' || u.role === 'SALES_MANAGER' || u.role === 'BUSINESS_MANAGER' || u.role === 'SUPPORT') setActiveView('operating-partner');
            else if (u.role === 'ADMIN' || u.role === 'FOUNDER' || u.role === 'OWNER') setActiveView('admin-panel');
            else setActiveView('customer-dashboard');
          }}
        />
      )}

      {onboardModalOpen && (
        <BusinessOnboardingModal
          currentUser={currentUser}
          categories={categories}
          cities={cities}
          onClose={() => setOnboardModalOpen(false)}
          onSuccess={(biz, newUser) => {
            if (newUser) {
              setCurrentUser(newUser);
            }
            loadBusinesses();
          }}
          onOpenAuth={() => {
            setOnboardModalOpen(false);
            setAuthInitialMode('register');
            setAuthModalOpen(true);
          }}
        />
      )}

      {legalModalType && (
        <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />
      )}

      {qrModalBusiness && (
        <QRCodeModal
          business={qrModalBusiness}
          onClose={() => setQrModalBusiness(null)}
        />
      )}

      {/* Floating QR Scanner Button (Desktop Only: hidden on mobile to prevent overlapping) */}
      <button
        id="floating-qr-scan-btn"
        onClick={() => setScanQRModalOpen(true)}
        className="hidden md:flex fixed bottom-8 right-8 z-30 items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white pl-4 pr-5 py-3 rounded-full shadow-xl shadow-blue-600/35 hover:shadow-blue-600/50 hover:scale-105 active:scale-95 transition-all cursor-pointer group border-2 border-white/90"
        title="QR Scanner — QR orqali navbat oling"
        aria-label="QR Scanner"
      >
        <div className="relative">
          <QrCode className="w-5 h-5 text-white transition-transform group-hover:rotate-12" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-blue-600 animate-ping" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-black uppercase tracking-wider leading-none">
            QR Scanner
          </span>
          <span className="text-[10px] text-blue-100 font-semibold leading-tight mt-0.5">
            QR orqali navbat oling
          </span>
        </div>
      </button>

      {/* Camera QR Scanner Modal */}
      {scanQRModalOpen && (
        <ScanQRModal
          isOpen={scanQRModalOpen}
          onClose={() => setScanQRModalOpen(false)}
          currentUser={currentUser}
          onSelectBusiness={handleSelectBusiness}
          onUserUpdate={(updated) => setCurrentUser(updated)}
        />
      )}

      {/* Persistent Mobile Bottom Navigation (Smartphones & Small Tablets) */}
      <MobileBottomNav
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        onOpenAuth={() => {
          setAuthInitialMode('login');
          setAuthModalOpen(true);
        }}
        onOpenScanQR={() => setScanQRModalOpen(true)}
      />
    </div>
  );
}
