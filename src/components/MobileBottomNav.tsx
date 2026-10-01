import React from 'react';
import { 
  Home, Search, Clock, Calendar, Briefcase, Shield, User as UserIcon, LogIn, QrCode
} from 'lucide-react';
import { User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface MobileBottomNavProps {
  activeView: 'home' | 'search' | 'business-detail' | 'customer-dashboard' | 'business-dashboard' | 'admin-panel' | 'operating-partner' | 'for-customers' | 'for-business';
  setActiveView: (view: 'home' | 'search' | 'customer-dashboard' | 'business-dashboard' | 'admin-panel' | 'operating-partner' | 'for-customers' | 'for-business') => void;
  currentUser?: User | null;
  user?: User | null;
  activeQueueCount?: number;
  onOpenAuth: () => void;
  onOpenScanQR: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  setActiveView,
  currentUser,
  user: userProp,
  activeQueueCount = 0,
  onOpenAuth,
  onOpenScanQR,
}) => {
  const user = currentUser ?? userProp ?? null;
  const { t } = useTranslation();

  return (
    <nav 
      aria-label="Mobil pastki menyu"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* 1. Asosiy (Home) */}
        <button
          id="mobile-nav-home"
          onClick={() => {
            setActiveView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[54px] min-h-[44px] cursor-pointer ${
            activeView === 'home'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className={`w-5 h-5 transition-transform ${activeView === 'home' ? 'scale-110 text-blue-600' : ''}`} />
          <span className="text-[10px] mt-1 font-medium leading-none">{t('bottom_home')}</span>
        </button>

        {/* 2. Katalog / Qidiruv */}
        <button
          id="mobile-nav-search"
          onClick={() => {
            setActiveView('search');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[54px] min-h-[44px] cursor-pointer ${
            activeView === 'search'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Search className={`w-5 h-5 transition-transform ${activeView === 'search' ? 'scale-110 text-blue-600' : ''}`} />
          <span className="text-[10px] mt-1 font-medium leading-none">{t('bottom_catalog')}</span>
        </button>

        {/* 3. CENTER ACTION: QR Scanner */}
        <button
          id="mobile-nav-scan-qr"
          onClick={onOpenScanQR}
          className="flex flex-col items-center justify-center -mt-4 min-w-[58px] min-h-[50px] group cursor-pointer"
          title="QR Scanner — QR orqali navbat oling"
          aria-label="QR Scanner"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 ring-4 ring-white group-active:scale-95 group-hover:shadow-blue-500/50 transition-all">
            <QrCode className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 font-bold text-blue-700 leading-none">
            QR Scanner
          </span>
        </button>

        {/* 4. Bronlarim / Jonli Navbat */}
        <button
          id="mobile-nav-bookings"
          onClick={() => {
            if (!user) {
              onOpenAuth();
            } else {
              setActiveView('customer-dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[54px] min-h-[44px] relative cursor-pointer ${
            activeView === 'customer-dashboard'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            {activeQueueCount > 0 ? (
              <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            ) : (
              <Calendar className={`w-5 h-5 transition-transform ${activeView === 'customer-dashboard' ? 'scale-110 text-blue-600' : ''}`} />
            )}
            {activeQueueCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-ping" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-medium leading-none">
            {activeQueueCount > 0 ? t('live_queue') : t('bottom_bookings')}
          </span>
        </button>

        {/* 5. Biznes yoki Hamkor yoki Admin yoki Profil */}
        {user?.role === 'OPERATING_PARTNER' || user?.role === 'SALES_MANAGER' || user?.role === 'BUSINESS_MANAGER' ? (
          <button
            id="mobile-nav-partner"
            onClick={() => {
              setActiveView('operating-partner');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-w-[60px] min-h-[44px] cursor-pointer ${
              activeView === 'operating-partner'
                ? 'text-emerald-500 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className={`w-5 h-5 transition-transform ${activeView === 'operating-partner' ? 'scale-110 text-emerald-500' : ''}`} />
            <span className="text-[10px] mt-1 font-medium leading-none">Hamkor</span>
          </button>
        ) : (user?.role === 'ADMIN' || user?.role === 'FOUNDER' || user?.role === 'OWNER') ? (
          <button
            id="mobile-nav-admin"
            onClick={() => {
              setActiveView('admin-panel');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-w-[60px] min-h-[44px] cursor-pointer ${
              activeView === 'admin-panel' || activeView === 'operating-partner'
                ? 'text-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className={`w-5 h-5 transition-transform ${activeView === 'admin-panel' || activeView === 'operating-partner' ? 'scale-110 text-emerald-600' : ''}`} />
            <span className="text-[10px] mt-1 font-medium leading-none">Boshqaruv</span>
          </button>
        ) : user?.role === 'BUSINESS_OWNER' ? (
          <button
            id="mobile-nav-business"
            onClick={() => {
              setActiveView('business-dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-w-[60px] min-h-[44px] cursor-pointer ${
              activeView === 'business-dashboard'
                ? 'text-indigo-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className={`w-5 h-5 transition-transform ${activeView === 'business-dashboard' ? 'scale-110 text-indigo-600' : ''}`} />
            <span className="text-[10px] mt-1 font-medium leading-none">{t('business_cabinet')}</span>
          </button>
        ) : user?.role === 'STAFF' ? (
          <button
            id="mobile-nav-staff"
            onClick={() => {
              setActiveView('business-dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-w-[60px] min-h-[44px] cursor-pointer ${
              activeView === 'business-dashboard'
                ? 'text-indigo-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className={`w-5 h-5 transition-transform ${activeView === 'business-dashboard' ? 'scale-110 text-indigo-600' : ''}`} />
            <span className="text-[10px] mt-1 font-medium leading-none">{t('business_cabinet')}</span>
          </button>
        ) : user ? (
          <button
            id="mobile-nav-profile"
            onClick={() => {
              setActiveView('customer-dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-w-[60px] min-h-[44px] cursor-pointer ${
              activeView === 'customer-dashboard'
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium leading-none truncate max-w-[50px]">
              {(user.name || '').split(' ')[0]}
            </span>
          </button>
        ) : (
          <button
            id="mobile-nav-login"
            onClick={onOpenAuth}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-w-[60px] min-h-[44px] text-slate-500 hover:text-blue-600 cursor-pointer"
          >
            <LogIn className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium leading-none">{t('sign_in')}</span>
          </button>
        )}
      </div>
    </nav>
  );
};
