import React from 'react';
import { Star, MapPin, Clock, CheckCircle, QrCode, ArrowRight, Heart, Sparkles, Megaphone, Navigation } from 'lucide-react';
import { BusinessItem } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface BusinessCardProps {
  business: BusinessItem;
  onSelect: (business: BusinessItem) => void;
  onOpenQR: (business: BusinessItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (businessId: string) => void;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({ 
  business, 
  onSelect, 
  onOpenQR,
  isFavorite = false,
  onToggleFavorite
}) => {
  const { t, translateCategory, translateCity } = useTranslation();
  const hasReviews = business.review_count > 0 && business.avg_rating !== null;
  const queueCount = business.active_queue_count || 0;
  const isSponsored = business.is_sponsored === 1;
  const isOpen = Boolean(business.is_open);
  const workingHours = business.working_hours || '09:00–18:00';

  // Card Status (Navbat mavjud / Yopiq / Navbat tugagan)
  const statusType: 'AVAILABLE' | 'CLOSED' | 'ENDED' = !isOpen
    ? 'CLOSED'
    : queueCount >= 50
    ? 'ENDED'
    : 'AVAILABLE';

  const statusLabel =
    statusType === 'CLOSED'
      ? 'Yopiq'
      : statusType === 'ENDED'
      ? 'Navbat tugagan'
      : 'Navbat mavjud';

  // Active Queue Traffic Calculation
  const hasActiveTraffic = queueCount > 0 && isOpen;
  const estimatedWaitMinutes = queueCount * 12;
  const waitPercentage = Math.min(100, Math.max(18, Math.round((estimatedWaitMinutes / 60) * 100)));
  
  const trafficVariant = 
    queueCount <= 2 
      ? {
          barColor: 'bg-emerald-500',
          textColor: 'text-emerald-700',
          bgColor: 'bg-emerald-50/70',
          borderColor: 'border-emerald-200/80',
          dotColor: 'bg-emerald-500',
          label: 'Tezkor qabul',
        }
      : queueCount <= 4
      ? {
          barColor: 'bg-amber-500',
          textColor: 'text-amber-800',
          bgColor: 'bg-amber-50/70',
          borderColor: 'border-amber-200/80',
          dotColor: 'bg-amber-500',
          label: 'O‘rtacha navbat',
        }
      : {
          barColor: 'bg-rose-500',
          textColor: 'text-rose-800',
          bgColor: 'bg-rose-50/70',
          borderColor: 'border-rose-200/80',
          dotColor: 'bg-rose-500',
          label: 'Yuqori tirbandlik',
        };

  return (
    <div className={`rounded-2xl overflow-hidden transition flex flex-col group relative ${
      isSponsored 
        ? 'bg-gradient-to-b from-amber-50/50 via-white to-white border-2 border-amber-400/90 shadow-sm hover:shadow-md hover:border-amber-500 ring-1 ring-amber-400/20' 
        : 'bg-white border border-slate-200 shadow-xs hover:shadow-md'
    }`}>
      {/* Sponsored top bar if active */}
      {isSponsored && (
        <div className="bg-amber-500 text-white text-[10px] font-extrabold uppercase px-3 py-1 flex items-center justify-between tracking-wide">
          <span className="flex items-center gap-1">
            <Megaphone className="w-3 h-3 text-amber-100" />
            <span>{t('recommended')}</span>
          </span>
          <span className="text-[9px] text-amber-100 font-semibold lowercase">{t('verified')}</span>
        </div>
      )}

      {/* Header image & badges */}
      <div className="relative h-44 bg-slate-100 overflow-hidden">
        <img
          src={business.logo_url || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=500&auto=format&fit=crop&q=80'}
          alt={business.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center">
          <span className="px-2.5 py-1 bg-white/95 backdrop-blur text-slate-900 text-xs font-bold rounded-lg shadow-xs">
            {translateCategory(business.category_slug || business.category_name)}
          </span>

          {/* Organic Recommendation badge if not sponsored */}
          {!isSponsored && business.is_recommended === 1 && (
            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-md flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3" />
              <span>{t('recommended')}</span>
            </span>
          )}

          {/* Real-time GPS Distance Badge */}
          {business.distance_km !== null && business.distance_km !== undefined && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-extrabold rounded-md flex items-center gap-1 shadow-xs animate-in fade-in">
              <Navigation className="w-2.5 h-2.5 fill-white" />
              <span>{Number(business.distance_km) < 1 ? `${Math.round(Number(business.distance_km) * 1000)} m` : `${Number(business.distance_km).toFixed(1)} km`}</span>
            </span>
          )}
        </div>

        {/* Action icons: Favorite & QR */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {onToggleFavorite && (
            <button
              id={`biz-fav-btn-${business.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(business.id);
              }}
              title={isFavorite ? 'Sevimlilardan o‘chirish' : 'Sevimlilarga saqlash'}
              className={`p-2 rounded-xl shadow-xs transition cursor-pointer ${
                isFavorite 
                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                  : 'bg-white/90 hover:bg-white text-slate-700 hover:text-rose-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-600' : ''}`} />
            </button>
          )}

          <button
            id={`biz-qr-btn-${business.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenQR(business);
            }}
            title={t('qr_code')}
            className="p-2 bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 rounded-xl shadow-xs transition cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>

        {/* Repositioned Badges: Absolute Bottom-Left (Rating) and Absolute Bottom-Right (Status & Queue) */}
        <div className="absolute bottom-2.5 left-2.5 z-10">
          {hasReviews ? (
            <div className="flex items-center gap-1 bg-slate-950/85 backdrop-blur-xs border border-white/10 px-2 py-0.5 rounded-md text-white text-[11px] font-bold shadow-xs">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>{Number(business.avg_rating).toFixed(1)}</span>
              <span className="text-slate-300 text-[10px] font-normal">({business.review_count})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-xs border border-emerald-400/40 px-2 py-0.5 rounded-md text-emerald-300 font-extrabold text-[10px] shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{t('sort_newest')}</span>
            </div>
          )}
        </div>

        {/* Status Badge in absolute bottom-right corner */}
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <div className={`flex items-center gap-1.5 backdrop-blur-xs border px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold shadow-xs ${
            statusType === 'CLOSED'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : statusType === 'ENDED'
              ? 'bg-slate-950/90 border-slate-600/40 text-slate-300'
              : 'bg-slate-950/90 border-amber-400/50 text-white'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              statusType === 'CLOSED' ? 'bg-rose-400' : statusType === 'ENDED' ? 'bg-slate-400' : 'bg-emerald-400 animate-pulse'
            }`}></span>
            <span>{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Body content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <h3 
              onClick={() => onSelect(business)}
              className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-blue-600 cursor-pointer transition"
            >
              {business.name}
            </h3>
            {business.is_verified === 1 && (
              <span title={t('verified')} className="inline-flex items-center">
                <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 line-clamp-2 mb-3">
            {business.description || t('footer_desc')}
          </p>

          <div className="space-y-1.5 text-xs text-slate-600 mb-3">
            <div className="flex items-center gap-1.5 justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="line-clamp-1">
                  {translateCity(business.city_name)}, {business.district ? `${business.district}, ` : ''}{business.address}
                </span>
              </div>
              {business.distance_km !== null && business.distance_km !== undefined && (
                <span className="shrink-0 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Navigation className="w-2.5 h-2.5" />
                  <span>{Number(business.distance_km) < 1 ? `${Math.round(Number(business.distance_km) * 1000)} m` : `${Number(business.distance_km).toFixed(1)} km`}</span>
                </span>
              )}
            </div>

            {/* Working Hours & Real status in Asia/Tashkent */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className={`font-semibold ${isOpen ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {isOpen ? 'Hozir ochiq' : 'Biznes hozir yopiq'}
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Ish vaqti: {workingHours}
              </span>
            </div>
          </div>

          {/* Queue Availability Status Bar */}
          {!isOpen ? (
            <div className="mt-1 mb-2 p-2 bg-rose-50 border border-rose-200/80 rounded-xl text-center text-[11px] font-bold text-rose-700">
              Biznes hozir yopiq. Ish vaqti: {workingHours}
            </div>
          ) : hasActiveTraffic ? (
            <div className={`mt-1 mb-2 p-2.5 rounded-xl border ${trafficVariant.borderColor} ${trafficVariant.bgColor} transition-all`}>
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold">
                <div className="flex items-center gap-1.5 text-slate-800">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${trafficVariant.dotColor}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${trafficVariant.dotColor}`}></span>
                  </span>
                  <span>Navbat: <strong className="text-slate-900">{queueCount} kishi</strong></span>
                </div>
                <div className={`flex items-center gap-1 font-extrabold ${trafficVariant.textColor}`}>
                  <Clock className="w-3 h-3" />
                  <span>~{estimatedWaitMinutes} daqiqa</span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full bg-slate-200/90 rounded-full h-2 overflow-hidden shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${trafficVariant.barColor}`}
                  style={{ width: `${waitPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 font-medium">
                <span>{trafficVariant.label}</span>
                <span className="font-semibold text-slate-600">Navbat mavjud</span>
              </div>
            </div>
          ) : (
            <div className="mt-1 mb-2 p-2 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center justify-between text-[11px] font-bold text-emerald-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Navbat mavjud</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-700">Kutishsiz qabul</span>
            </div>
          )}
        </div>

        {/* Action Button: “Navbat olish” */}
        <div className="pt-3 border-t border-slate-100">
          <button
            id={`biz-view-btn-${business.id}`}
            onClick={() => onSelect(business)}
            className={`w-full py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 min-h-[42px] cursor-pointer active:scale-[0.98] ${
              isOpen
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-blue-100" />
            <span>{t('take_queue')}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
