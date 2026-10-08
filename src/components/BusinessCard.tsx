import React from 'react';
import { ArrowRight, Building2, CheckCircle2, Clock3, Heart, MapPin, Navigation, QrCode, Star, Users } from 'lucide-react';
import { BusinessItem } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface BusinessCardProps {
  business: BusinessItem;
  onSelect: (business: BusinessItem) => void;
  onOpenQR: (business: BusinessItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (businessId: string) => void;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({ business, onSelect, onOpenQR, isFavorite = false, onToggleFavorite }) => {
  const { t, translateCategory, translateCity } = useTranslation();
  const open = Boolean(business.is_open);
  const queues = business.active_queue_count || 0;
  const distance = business.distance_km;
  return <article className="business-card group flex flex-col overflow-hidden bg-white border border-slate-200 transition-shadow">
    <div className="relative h-44 sm:h-48 bg-slate-100 overflow-hidden">
      {business.logo_url ? <img src={business.logo_url} alt={business.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="h-full flex items-center justify-center text-slate-300"><Building2 size={56} /></div>}
      <span className="absolute top-3 left-3 rounded-lg px-2.5 py-1.5 bg-white/95 text-xs font-medium text-slate-700 max-w-[65%] truncate">{translateCategory(business.category_slug || business.category_name)}</span>
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        {onToggleFavorite && <button id={`biz-fav-btn-${business.id}`} aria-label={isFavorite ? 'Sevimlilardan o‘chirish' : 'Sevimlilarga saqlash'} aria-pressed={isFavorite} onClick={() => onToggleFavorite(business.id)} className="w-11 h-11 rounded-full bg-white/95 shadow-sm flex items-center justify-center hover:bg-white"><Heart size={18} className={isFavorite ? 'text-rose-500 fill-rose-500' : 'text-slate-600'} /></button>}
        <button id={`biz-qr-btn-${business.id}`} aria-label={`${business.name}: ${t('qr_code')}`} onClick={() => onOpenQR(business)} className="w-11 h-11 rounded-full bg-white/95 shadow-sm flex items-center justify-center hover:bg-white text-slate-600"><QrCode size={18} /></button>
      </div>
      {business.is_sponsored === 1 && <span className="absolute bottom-3 left-3 rounded-lg px-2.5 py-1 bg-slate-900/85 text-xs text-white">Tavsiya etilgan · Reklama</span>}
    </div>
    <div className="p-5 flex flex-col flex-1">
      <div className="flex items-center justify-between gap-2 text-xs mb-3">
        <span className={`inline-flex items-center gap-1.5 font-medium ${open ? 'text-emerald-700' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-slate-400'}`} />{open ? 'Hozir ochiq' : 'Hozir yopiq'}</span>
        {business.review_count > 0 && business.avg_rating !== null ? <span className="flex items-center gap-1 text-slate-700"><Star size={14} className="fill-amber-400 text-amber-400" /><strong>{Number(business.avg_rating).toFixed(1)}</strong><span className="text-slate-500">({business.review_count})</span></span> : <span className="text-slate-500">Yangi biznes</span>}
      </div>
      <h3 className="flex items-start gap-1.5 text-base font-bold text-slate-900 leading-snug"><button onClick={() => onSelect(business)} className="text-left hover:text-blue-600">{business.name}</button>{business.is_verified === 1 && <CheckCircle2 size={17} aria-label="Tekshirilgan" className="text-blue-600 shrink-0 mt-0.5" />}</h3>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed line-clamp-2">{business.description || translateCategory(business.category_slug || business.category_name)}</p>
      <div className="space-y-2.5 text-xs text-slate-500 mt-4 mb-5">
        <p className="flex items-start gap-2"><MapPin size={15} className="shrink-0 mt-0.5" /><span className="line-clamp-2">{translateCity(business.city_name)}, {business.address}</span></p>
        {business.working_hours && <p className="flex items-center gap-2"><Clock3 size={15} />{business.working_hours}</p>}
        {distance !== null && distance !== undefined && <p className="flex items-center gap-2 text-blue-600"><Navigation size={15} />{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`} uzoqlikda</p>}
      </div>
      <div className="mt-auto">
        <div className="border-t border-slate-100 pt-3 mb-3 flex items-center gap-2 text-xs text-slate-500"><Users size={15} />{queues > 0 ? `Navbatda ${queues} kishi` : 'Hozir navbat yo‘q'}</div>
        <button id={`biz-view-btn-${business.id}`} onClick={() => onSelect(business)} className="w-full min-h-12 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white flex justify-center items-center gap-2 text-sm font-semibold transition-colors">{open ? t('take_queue') : 'Xizmatlarni ko‘rish'}<ArrowRight size={17} /></button>
      </div>
    </div>
  </article>;
};
