import React, { useEffect, useState } from 'react';
import { 
  Clock, Shield, Briefcase,
  LogOut, Menu, X, MapPin, Send, Globe, QrCode
} from 'lucide-react';
import { User, City } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NavbatBorLogo } from './NavbatBorLogo';

interface NavbarProps {
  user: User | null;
  cities: City[];
  selectedCity: string;
  onSelectCity: (cityId: string) => void;
  activeView: 'home' | 'search' | 'business-detail' | 'customer-dashboard' | 'business-dashboard' | 'admin-panel' | 'operating-partner' | 'for-customers' | 'for-business';
  setActiveView: (view: 'home' | 'search' | 'customer-dashboard' | 'business-dashboard' | 'admin-panel' | 'operating-partner' | 'for-customers' | 'for-business') => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
  activeQueueCount: number;
  onOpenBusinessOnboarding?: () => void;
  onOpenScanQR?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  cities,
  selectedCity,
  onSelectCity,
  activeView,
  setActiveView,
  onOpenAuth,
  onLogout,
  activeQueueCount,
  onOpenBusinessOnboarding,
  onOpenScanQR,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { t, translateCity, lang, setLang, languages } = useTranslation();
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        document.getElementById('mobile-hamburger-btn')?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  const navigateTo = (view: 'home' | 'search' | 'customer-dashboard' | 'business-dashboard' | 'admin-panel' | 'operating-partner' | 'for-customers' | 'for-business') => {
    setActiveView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="site-header sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo & Location */}
        <div className="flex items-center gap-3 sm:gap-5">
          <button 
            id="nav-logo-btn"
            onClick={() => navigateTo('home')} 
            className="flex items-center text-left focus:outline-none group min-h-[44px] cursor-pointer"
          >
            <NavbatBorLogo variant="horizontal" size="md" />
          </button>

          {/* City selector / indicator (Visible on tablet & desktop: md:flex) */}
          {cities.length <= 1 ? (
            <div className="hidden md:flex items-center gap-1.5 text-xs bg-blue-50/80 border border-blue-200/60 px-3 py-1.5 rounded-xl transition min-h-[38px] text-blue-900 font-semibold shadow-xs">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{cities[0] ? translateCity(cities[0].name) : 'Qarshi'}</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-xl transition min-h-[38px]">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                id="nav-city-select"
                aria-label="Shaharni tanlash"
                value={selectedCity}
                onChange={(e) => onSelectCity(e.target.value)}
                className="bg-transparent font-medium text-slate-800 cursor-pointer focus:outline-none text-xs"
              >
                <option value="">{t('select_city')} ({t('cat_all')})</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {translateCity(c.name)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Desktop Language Selector */}
          <div className="hidden md:block">
            <LanguageSwitcher idPrefix="nav-desktop" />
          </div>
        </div>

        {/* Action Links (Desktop & Tablet) */}
        <div className="hidden xl:flex items-center gap-2 xl:gap-3">
          <button
            id="nav-catalog-btn"
            onClick={() => navigateTo('search')}
            className={`px-3 py-2 text-xs lg:text-sm font-semibold rounded-xl transition min-h-[40px] flex items-center cursor-pointer ${
              activeView === 'search'
                ? 'text-blue-600 bg-blue-50 font-bold'
                : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
            }`}
          >
            {t('catalog')}
          </button>

          <button
            id="nav-customers-benefits-btn"
            onClick={() => navigateTo('for-customers')}
            className={`px-3 py-2 text-xs lg:text-sm font-semibold rounded-xl transition min-h-[40px] flex items-center cursor-pointer ${
              activeView === 'for-customers'
                ? 'text-blue-600 bg-blue-50 font-bold'
                : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
            }`}
          >
            Mijozlarga
          </button>

          <button
            id="nav-business-benefits-btn"
            onClick={() => navigateTo('for-business')}
            className={`px-3 py-2 text-xs lg:text-sm font-semibold rounded-xl transition min-h-[40px] flex items-center cursor-pointer ${
              activeView === 'for-business'
                ? 'text-indigo-600 bg-indigo-50 font-bold'
                : 'text-slate-700 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            Biznesga
          </button>

          {(!user || user.role === 'CUSTOMER') && onOpenBusinessOnboarding && (
            <button
              id="nav-onboard-business-btn"
              onClick={onOpenBusinessOnboarding}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs lg:text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition min-h-[40px] cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('connect_business')}</span>
            </button>
          )}

          {/* Active Queue pill if customer has active queue */}
          {activeQueueCount > 0 && (
            <button
              id="nav-active-queue-btn"
              onClick={() => navigateTo('customer-dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl animate-pulse min-h-[40px] cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('live_queue')}</span>
            </button>
          )}

          {/* Role specific links */}
          {user ? (
            <div className="flex items-center gap-2">
              {user.role === 'CUSTOMER' && (
                <button
                  id="nav-customer-dashboard-btn"
                  onClick={() => navigateTo('customer-dashboard')}
                  className={`px-3 py-2 text-xs lg:text-sm font-semibold rounded-xl transition min-h-[40px] flex items-center cursor-pointer ${
                    activeView === 'customer-dashboard'
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t('my_bookings')}
                </button>
              )}

              {(user.role === 'BUSINESS_OWNER' || user.role === 'STAFF') && (
                <button
                  id="nav-business-dashboard-btn"
                  onClick={() => navigateTo('business-dashboard')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs lg:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition min-h-[40px] cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>{t('business_cabinet')}</span>
                </button>
              )}

              {(user.role === 'OPERATING_PARTNER' || user.role === 'SALES_MANAGER' || user.role === 'BUSINESS_MANAGER') && (
                <button
                  id="nav-partner-btn"
                  onClick={() => navigateTo('operating-partner')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs lg:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition min-h-[40px] cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Hamkor Kabineti</span>
                </button>
              )}

              {(user.role === 'ADMIN' || user.role === 'FOUNDER' || user.role === 'OWNER') && (
                <div className="flex items-center gap-1.5">
                  <button
                    id="nav-partner-admin-btn"
                    onClick={() => navigateTo('operating-partner')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs lg:text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition min-h-[40px] cursor-pointer"
                    title="Qarshi Hamkor Boshqaruvi"
                  >
                    <Briefcase className="w-4 h-4 text-emerald-600" />
                    <span>Hamkorlik</span>
                  </button>
                  <button
                    id="nav-admin-btn"
                    onClick={() => navigateTo('admin-panel')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs lg:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition min-h-[40px] cursor-pointer"
                  >
                    <Shield className="w-4 h-4" />
                    <span>{t('admin_panel')}</span>
                  </button>
                </div>
              )}

              {/* User profile & logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="text-right hidden lg:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-500 font-medium capitalize">{user.role.toLowerCase().replace('_', ' ')}</div>
                </div>
                <button
                  id="nav-logout-btn"
                  onClick={onLogout}
                  title={t('logout')}
                  className="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="nav-login-btn"
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-2 text-xs lg:text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition min-h-[40px] cursor-pointer"
              >
                {t('sign_in')}
              </button>
              <button
                id="nav-register-btn"
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 text-xs lg:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition min-h-[40px] cursor-pointer"
              >
                {t('sign_up')}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Action & Hamburger Button (md:hidden) */}
        <div className="flex items-center gap-2 xl:hidden">
          {/* Direct 1-tap language switch on mobile header */}
          <LanguageSwitcher idPrefix="nav-mobile-top" />

          {activeQueueCount > 0 && (
            <button
              onClick={() => navigateTo('customer-dashboard')}
              className="p-2 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 flex items-center justify-center min-h-[44px] min-w-[44px]"
            >
              <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
            </button>
          )}

          <button
            id="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menyu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-header-menu"
            className="p-2.5 text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-200 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* MOBILE EXPANDED MENU DRAWER (md:hidden) */}
      {mobileMenuOpen && (
        <div id="mobile-header-menu" className="xl:hidden bg-white border-b border-slate-200 shadow-xl px-4 py-4 space-y-4 max-h-[calc(100dvh-140px)] overflow-y-auto overscroll-contain">
          {/* Language selector segmented row in mobile menu */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('select_language')}</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {languages.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={`py-2 px-1 text-xs font-bold rounded-xl transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    lang === l.code
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base">{l.flag}</span>
                  <span className="text-[11px] font-semibold">{l.nativeLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* City selector on mobile */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('select_city')}:</span>
            </label>
            {cities.length <= 1 ? (
              <div className="w-full bg-blue-50 border border-blue-200/80 font-semibold text-blue-900 text-sm rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span>{cities[0] ? translateCity(cities[0].name) : 'Qarshi'}</span>
                <span className="text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-bold">Asosiy shahar</span>
              </div>
            ) : (
              <select
                aria-label={t('select_city')}
                value={selectedCity}
                onChange={(e) => {
                  onSelectCity(e.target.value);
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-white border border-slate-300 font-semibold text-slate-800 text-sm rounded-xl px-3 py-2.5 focus:outline-blue-600 min-h-[44px]"
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

          {/* Navigation Links */}
          <div className="space-y-1">
            <button
              onClick={() => navigateTo('home')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between min-h-[44px] cursor-pointer ${
                activeView === 'home' ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>{t('bottom_home')}</span>
            </button>

            <button
              onClick={() => navigateTo('search')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between min-h-[44px] cursor-pointer ${
                activeView === 'search' ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>{t('catalog')}</span>
            </button>

            {onOpenScanQR && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenScanQR();
                }}
                className="w-full text-left px-3.5 py-3 rounded-xl text-sm font-bold text-blue-700 hover:bg-blue-50 transition flex items-center gap-2 min-h-[44px] cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>{t('scan_qr')} ({t('scan_qr_instant_checkin')})</span>
              </button>
            )}

            {(!user || user.role === 'CUSTOMER') && onOpenBusinessOnboarding && (
              <button
                id="mobile-onboard-business-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBusinessOnboarding();
                }}
                className="w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold text-blue-700 hover:bg-blue-50 transition flex items-center gap-2 min-h-[44px] cursor-pointer"
              >
                <Send className="w-4 h-4 text-blue-600" />
                <span>{t('connect_business')}</span>
              </button>
            )}

            {user && (
              <>
                {user.role === 'CUSTOMER' && (
                  <button
                    onClick={() => navigateTo('customer-dashboard')}
                    className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between min-h-[44px] cursor-pointer ${
                      activeView === 'customer-dashboard'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>{t('my_bookings')}</span>
                  </button>
                )}

                {(user.role === 'BUSINESS_OWNER' || user.role === 'STAFF') && (
                  <button
                    onClick={() => navigateTo('business-dashboard')}
                    className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between min-h-[44px] cursor-pointer ${
                      activeView === 'business-dashboard'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                      <span>{t('business_cabinet')}</span>
                    </span>
                  </button>
                )}

                {(user.role === 'OPERATING_PARTNER' || user.role === 'SALES_MANAGER' || user.role === 'BUSINESS_MANAGER' || user.role === 'ADMIN' || user.role === 'FOUNDER' || user.role === 'OWNER') && (
                  <button
                    onClick={() => navigateTo('operating-partner')}
                    className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between min-h-[44px] cursor-pointer ${
                      activeView === 'operating-partner'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-emerald-600" />
                      <span>Operating Partner (Qarshi)</span>
                    </span>
                  </button>
                )}

                {(user.role === 'ADMIN' || user.role === 'FOUNDER' || user.role === 'OWNER') && (
                  <button
                    onClick={() => navigateTo('admin-panel')}
                    className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between min-h-[44px] cursor-pointer ${
                      activeView === 'admin-panel'
                        ? 'bg-rose-50 text-rose-700'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-rose-600" />
                      <span>{t('admin_panel')}</span>
                    </span>
                  </button>
                )}
              </>
            )}

            {/* Telegram Bot Link in mobile menu */}
            <a
              href="https://t.me/navbatbor_biznes_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between min-h-[44px] bg-[#2AABEE]/10 text-blue-700"
            >
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4 fill-[#0088cc]" />
                <span>{t('telegram_bot')}</span>
              </span>
              <span className="text-xs font-bold bg-[#2AABEE] text-white px-2 py-0.5 rounded-full">↗</span>
            </a>
          </div>

          {/* User Auth Info & Logout or Login */}
          <div className="pt-3 border-t border-slate-200">
            {user ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-slate-900">{user.name}</div>
                  <div className="text-[11px] text-slate-500">{user.phone || user.email}</div>
                  <div className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('logout')}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('login');
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition min-h-[44px] flex items-center justify-center cursor-pointer"
                >
                  {t('sign_in')}
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('register');
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition min-h-[44px] flex items-center justify-center shadow-xs cursor-pointer"
                >
                  {t('sign_up')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
