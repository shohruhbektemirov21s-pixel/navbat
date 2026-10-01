import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Star, MapPin, Phone, Clock, CheckCircle, QrCode, 
  ArrowLeft, Calendar, Users, Tv, Megaphone, Navigation, 
  ExternalLink, Send, ShieldCheck, Sparkles,
  Award, Zap, CreditCard, Bell, ChevronRight, Check,
  Search, ZoomIn, FileText, CheckSquare, Layers
} from 'lucide-react';
import { api } from '../api';
import { Service, StaffMember, BusinessHours, Review, User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { BookingModal } from './BookingModal';
import { QueueModal } from './QueueModal';
import { QRCodeModal } from './QRCodeModal';
import { QueueBoardModal } from './QueueBoardModal';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { asArray } from '../utils/safe';

interface BusinessDetailProps {
  slug: string;
  currentUser: User | null;
  userCoords?: { lat: number; lng: number } | null;
  onBack: () => void;
  onOpenAuth: () => void;
  onBookingSuccess: (booking: any) => void;
  onGoToBookings?: () => void;
}

interface GalleryItem {
  url: string;
  title: string;
  tag?: string;
}

export const BusinessDetail: React.FC<BusinessDetailProps> = ({
  slug,
  currentUser,
  userCoords,
  onBack,
  onOpenAuth,
  onBookingSuccess,
  onGoToBookings
}) => {
  const { t, translateCategory, translateCity, lang } = useTranslation();
  const [data, setData] = useState<{
    business: any;
    services: Service[];
    staff: StaffMember[];
    hours: BusinessHours[];
    reviews: Review[];
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [activeServiceIdForBooking, setActiveServiceIdForBooking] = useState<string | undefined>(undefined);
  const [showQueueModal, setShowQueueModal] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [showQueueBoardModal, setShowQueueBoardModal] = useState<boolean>(false);

  // Gallery state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Description language toggle
  const [descLang, setDescLang] = useState<'uz' | 'ru'>('uz');

  // Service search query
  const [serviceSearch, setServiceSearch] = useState<string>('');

  useEscapeKey(() => setIsLightboxOpen(false), isLightboxOpen);

  /** Bumped to refetch silently (e.g. after joining the queue) without unmounting open modals. */
  const [reloadKey, setReloadKey] = useState<number>(0);
  const loadedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDetail = async () => {
      const silent = loadedSlugRef.current === slug;
      if (!silent) setLoading(true);
      try {
        let coords = userCoords;
        if (!coords) {
          try {
            const s = sessionStorage.getItem('navbatbor_user_coords');
            if (s) coords = JSON.parse(s);
          } catch (e) {}
        }
        const res = await api.getBusinessBySlug(slug, coords || undefined);
        if (cancelled) return;
        loadedSlugRef.current = slug;
        // Normalise list fields so the page never crashes on a partial payload.
        setData(
          res?.business
            ? {
                business: res.business,
                services: asArray(res.services),
                staff: asArray(res.staff),
                hours: asArray(res.hours),
                reviews: asArray(res.reviews),
              }
            : null
        );
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching business details:', err);
          if (!silent) setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [slug, userCoords, reloadKey]);

  // Sync initial description language with global app language
  useEffect(() => {
    if (lang === 'ru') {
      setDescLang('ru');
    } else {
      setDescLang('uz');
    }
  }, [lang]);

  const dayNamesUz = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  const dayNamesRu = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNames = lang === 'ru' ? dayNamesRu : lang === 'en' ? dayNamesEn : dayNamesUz;

  // Build curated image gallery accommodating rich photos, facilities, and technical infographics
  const galleryImages: GalleryItem[] = useMemo(() => {
    if (!data?.business) return [];
    const biz = data.business;
    const mainImg = biz.logo_url || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&auto=format&fit=crop&q=80';
    const cSlug = (biz.category_slug || '').toLowerCase();

    if (cSlug.includes('tibbiyot') || cSlug.includes('medicine')) {
      return [
        { url: mainImg, title: "Klinika fasadi va asosiy bino", tag: "Fasad" },
        { url: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&auto=format&fit=crop&q=80', title: 'Diagnostika va shifokor qabul xonasi', tag: 'Qabulxona' },
        { url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop&q=80', title: 'Ilg‘or tibbiy diagnostika apparatlari', tag: 'Uskunalar' },
        { url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&auto=format&fit=crop&q=80', title: 'Sertifikatlangan shifokorlar ko‘rigi', tag: 'Mutaxassislar' },
        { url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80', title: 'SanPiN 100% sterilizatsiya va gigiyena kafolati', tag: 'Sterillik' }
      ];
    }
    if (cSlug.includes('stomatologiya') || cSlug.includes('dent')) {
      return [
        { url: mainImg, title: "Stomatologiya markazi", tag: "Fasad" },
        { url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=80', title: 'Muolaja kreslosi va steril kabinet', tag: 'Kabinet' },
        { url: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800&auto=format&fit=crop&q=80', title: 'Raqamli rentgen va tish skaneri', tag: 'Uskunalar' },
        { url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&auto=format&fit=crop&q=80', title: 'Avtoklav va xirurgik gigiyena', tag: 'SanPiN' }
      ];
    }
    if (cSlug.includes('avto')) {
      return [
        { url: mainImg, title: "Avtoservis bosh ustaxonasi", tag: "Fasad" },
        { url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80', title: 'Kompyuterli diagnostika stendi', tag: 'Diagnostika' },
        { url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80', title: 'Moy almashtirish va moylash boksi', tag: 'Texnik xizmat' },
        { url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80', title: 'Professional ustalar zonasi', tag: 'Ustaxona' }
      ];
    }
    if (cSlug.includes('gozallik') || cSlug.includes('barber')) {
      return [
        { url: mainImg, title: "Salon ko‘rinishi va interyer", tag: "Interyer" },
        { url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop&q=80', title: 'Professional xizmat ko‘rsatish stoli', tag: 'Xizmat zonasi' },
        { url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80', title: 'Premium kosmetika va steril asboblar', tag: 'Sifat' },
        { url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80', title: 'Mijozlar kutish zali', tag: 'Kutish zali' }
      ];
    }
    return [
      { url: mainImg, title: "Muassasa ko‘rinishi", tag: "Asosiy" },
      { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80', title: 'Mijozlar qabulxonasi', tag: 'Qabulxona' },
      { url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&auto=format&fit=crop&q=80', title: 'Zamonaviy xizmat xonasi', tag: 'Xona' }
    ];
  }, [data?.business]);

  // Generate SEO-rich, keyword-targeted bilingual descriptions
  const seoDescriptions = useMemo(() => {
    if (!data?.business) return { uz: '', ru: '' };
    const biz = data.business;
    const servicesList = data.services || [];
    const serviceNames = servicesList.map(s => s.name).join(', ') || 'asosiy xizmatlar';

    const uz = `"${biz.name}" — ${biz.city_name || 'Qarshi'} shahrida sifatli va ishonchli xizmat ko‘rsatuvchi yetakchi ${biz.category_name || 'muassasa'} hisoblanadi. 

Muassasa ${biz.district ? biz.district + ' hududida, ' : ''}${biz.address} manzilida joylashgan bo‘lib, bemorlar va tashrif buyuruvchilar uchun qulay sharoitlar, bepul avtoturargoh hamda qulay transport infratuzilmasiga ega.

Bizda taqdim etilayotgan asosiy xizmatlar: ${serviceNames}. Barcha muolajalar va xizmatlar malakali, ko‘p yillik amaliy tajribaga ega sertifikatlangan mutaxassislar tomonidan xalqaro va davlat SanPiN sanitariya-gigiyena standartlariga to‘liq amal qilingan holda amalga oshiriladi.

NavbatBor yagona platformasi bilan integratsiya orqali siz real vaqtda jonli elektron navbat holatini kuzatishingiz, uydan chiqmasdan navbat chiptasini olishingiz yoki o‘zingizga mos aniq sana va vaqtni bepul band qilishingiz mumkin. Qabulga 1 soat qolganda Telegram orqali eslatma yuboriladi.`;

    const ru = `"${biz.name}" — ведущее сертифицированное учреждение в городе ${biz.city_name || 'Карши'}, специализирующееся в направлении "${biz.category_name || 'услуги'}".

Адрес учреждения: г. ${biz.city_name || 'Карши'}, ${biz.district ? biz.district + ', ' : ''}${biz.address}. Для клиентов предусмотрены комфортабельные зоны ожидания, транспортная доступность и удобная парковка.

Спектр оказываемых профессиональных услуг включает: ${serviceNames}. Все процедуры и сервисы выполняются дипломированными специалистами высшей категории с использованием современного высокоточного оборудования и 100% соблюдением санитарно-эпидемиологических требований (СанПиН).

Благодаря единой системе NavbatBor вы можете следить за динамикой живой электронной очереди онлайн, получать электронный талон и бронировать точное время приема без очередей и переплат с мгновенным подтверждением в Telegram.`;

    return { uz, ru };
  }, [data]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-xs text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span>{t('loading')}</span>
      </div>
    );
  }

  if (!data || !data.business) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-lg font-bold text-slate-900">{t('business_not_found')}</h2>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          {t('back_to_catalog')}
        </button>
      </div>
    );
  }

  const { business, services, staff, hours, reviews } = data;
  const queueCount = business.active_queue_count || 0;
  const estimatedWait = queueCount * 12;

  // Filtered services based on search query
  const filteredServices = services.filter((s) => {
    if (!serviceSearch.trim()) return true;
    const q = serviceSearch.toLowerCase().trim();
    return (s.name || '').toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
  });

  const activePhoto = galleryImages[selectedImageIndex] || galleryImages[0] || { url: business.logo_url, title: business.name };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 space-y-8">
      {/* 1. Breadcrumbs & Top Utility Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500 overflow-x-auto no-scrollbar">
          <button
            id="biz-detail-back-btn"
            onClick={onBack}
            className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('back_to_catalog')}</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="text-slate-600 whitespace-nowrap">{translateCity(business.city_name)}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="text-slate-600 whitespace-nowrap">{translateCategory(business.category_slug || business.category_name)}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="font-bold text-slate-900 truncate max-w-[200px]">{business.name}</span>
        </div>

        {/* Action icons: TV Screen, QR Code, Share */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="biz-tv-board-btn"
            onClick={() => setShowQueueBoardModal(true)}
            title="TV Tablo rejimi"
            className="p-2 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl transition flex items-center gap-1.5 text-xs font-bold shadow-xs border border-amber-400/40 cursor-pointer"
          >
            <Tv className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">TV Tablo</span>
          </button>

          <button
            id="biz-detail-qr-btn"
            onClick={() => setShowQRModal(true)}
            title={t('qr_code')}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">{t('qr_code')}</span>
          </button>

          <a
            id="biz-detail-tg-share-btn"
            href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(`🏥 ${business.name} - NavbatBor onlayn navbat va bronlash:`)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Telegramda ulashish"
            className="p-2 bg-[#2AABEE] hover:bg-[#2297d4] text-white rounded-xl transition flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 fill-white" />
            <span className="hidden sm:inline">Ulashish</span>
          </a>
        </div>
      </div>

      {/* 2. HIGH-CONVERTING MARKETPLACE HERO CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Prominent Multi-Image Gallery with Infographic Tags */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* Primary Main Viewport */}
            <div className="relative h-72 sm:h-96 w-full rounded-2xl bg-slate-900 overflow-hidden group">
              <img
                src={activePhoto.url}
                alt={activePhoto.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />

              {/* Top badges on image */}
              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
                <span className="px-2.5 py-1 bg-white/95 backdrop-blur text-slate-900 text-xs font-bold rounded-lg shadow-sm">
                  {translateCategory(business.category_slug || business.category_name)}
                </span>
                {business.is_verified === 1 && (
                  <span className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-extrabold rounded-lg shadow-sm flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{t('verified')}</span>
                  </span>
                )}
                {business.is_sponsored === 1 && (
                  <span className="px-2.5 py-1 bg-amber-500 text-slate-950 text-xs font-black rounded-lg shadow-sm flex items-center gap-1">
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>{t('recommended')}</span>
                  </span>
                )}
              </div>

              {/* Zoom & Lightbox Trigger */}
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                title={t('view_large_photo')}
                className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl backdrop-blur transition cursor-pointer border border-white/20 shadow-md"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {/* Bottom Caption & Technical Tag */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white z-10">
                <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-medium max-w-[80%] truncate">
                  <span className="text-blue-400 font-bold mr-1.5">[{activePhoto.tag || 'Foto'}]</span>
                  <span>{activePhoto.title}</span>
                </div>
                <div className="text-[11px] font-mono bg-black/60 px-2 py-1 rounded-lg text-slate-300">
                  {selectedImageIndex + 1} / {galleryImages.length}
                </div>
              </div>
            </div>

            {/* Interactive Thumbnail Carousel Strip */}
            <div className="grid grid-cols-5 gap-2">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative h-16 sm:h-20 rounded-xl overflow-hidden border-2 transition cursor-pointer group ${
                    selectedImageIndex === idx 
                      ? 'border-blue-600 ring-2 ring-blue-600/30 shadow-md scale-100' 
                      : 'border-slate-200 hover:border-slate-300 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                    referrerPolicy="no-referrer"
                  />
                  {img.tag && (
                    <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-white text-[9px] font-bold text-center py-0.5 truncate px-1">
                      {img.tag}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Technical Infographic Trust Banner */}
            <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-800">SanPiN & Sifat Standarti Nazorati</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                100% Tasdiqlangan
              </span>
            </div>
          </div>

          {/* RIGHT: High-Converting Buy / Book Decision Box */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {translateCategory(business.category_slug || business.category_name)}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-slate-500">
                  ID: #{business.slug.slice(0, 10)}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight">
                {business.name}
              </h1>

              {/* Ratings and Reviews */}
              <div className="flex items-center gap-3 mt-2 text-xs">
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="font-extrabold text-amber-950">{Number(business.avg_rating || 5).toFixed(1)}</span>
                </div>
                <span className="text-slate-600 font-medium">
                  {reviews.length > 0 ? t('reviews_count', { count: reviews.length }) : 'Hozircha yangi muassasa'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{business.is_open ? t('open_now') : t('closed_now')}</span>
                </span>
              </div>
            </div>

            {/* Address & GPS distance */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 text-slate-700 min-w-0">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    <strong className="text-slate-900">{translateCity(business.city_name)}</strong>, {business.district ? `${business.district}, ` : ''}{business.address}
                  </span>
                </div>
                {business.distance_km !== null && business.distance_km !== undefined && (
                  <span className="shrink-0 px-2 py-0.5 bg-blue-100 text-blue-800 font-extrabold rounded-md text-[10px] flex items-center gap-1">
                    <Navigation className="w-2.5 h-2.5 fill-blue-800" />
                    <span>{business.distance_km < 1 ? `${Math.round(business.distance_km * 1000)} m` : `${business.distance_km.toFixed(1)} km`}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <a href={`tel:${business.phone}`} className="font-bold text-slate-900 hover:text-blue-600 transition">
                  {business.phone}
                </a>
              </div>
            </div>

            {/* REAL-TIME LIVE QUEUE STATUS BOX (High Contrast & Clear) */}
            <div className="p-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <span className="font-black text-slate-950 uppercase tracking-wide">Jonli Elektron Navbat</span>
                </div>
                <span className="font-black text-amber-950 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-lg text-xs">
                  {queueCount > 0 ? `${queueCount} kishi navbatda` : 'Navbat bo‘sh (Kutishsiz)'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                <span>Taxminiy qabulgacha vaqt:</span>
                <span className="font-extrabold text-slate-950">~{estimatedWait > 0 ? estimatedWait : 5} daqiqa</span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    queueCount <= 2 ? 'bg-emerald-500' : queueCount <= 5 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(15, queueCount * 20))}%` }}
                />
              </div>
            </div>

            {/* DUAL PRIMARY ACTION TRIGGERS (High-Converting Conversion CTAs) */}
            <div className="space-y-2.5 pt-1">
              {!business.is_open && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-center text-xs font-bold text-rose-700 space-y-0.5">
                  <div>🔴 Biznes hozir yopiq</div>
                  <div className="text-[11px] font-medium text-rose-600">
                    Ish vaqti: {business.working_hours || '09:00–18:00'} (Asia/Tashkent). Navbat qabuli vaqtincha to‘xtatilgan.
                  </div>
                </div>
              )}

              <button
                type="button"
                id="biz-hero-book-btn"
                onClick={() => setShowBookingModal(true)}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-sm font-extrabold transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 min-h-[48px] cursor-pointer active:scale-[0.98]"
              >
                <Calendar className="w-4 h-4" />
                <span>{t('book_time')} (Onlayn bron)</span>
              </button>

              {business.is_open ? (
                <button
                  type="button"
                  id="biz-hero-queue-btn"
                  onClick={() => setShowQueueModal(true)}
                  className="w-full py-3.5 px-6 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-2xl text-sm font-black transition shadow-sm border border-amber-500/70 flex items-center justify-center gap-2 min-h-[48px] cursor-pointer active:scale-[0.98]"
                >
                  <Clock className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  <span>{t('join_queue')} (Elektron chipta olish)</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="biz-hero-queue-btn"
                  disabled
                  className="w-full py-3.5 px-6 bg-slate-100 border border-slate-200 text-slate-400 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 min-h-[48px] cursor-not-allowed"
                >
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Biznes hozir yopiq — Navbat qabuli to‘xtatilgan</span>
                </button>
              )}
            </div>

            {/* Marketplace Guarantees (3 Value Bullets) */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                <span>Onlayn navbat va bronlash 100% bepul (komissiyasiz)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                <span>Kafolatlangan aniq vaqtda mutaxassis qabuli</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                <span>Telegram bot orqali avtomatik eslatma va chipta</span>
              </div>
            </div>

            {/* Quick map links */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`https://yandex.uz/maps/?text=${encodeURIComponent((business.latitude && business.longitude) ? `${business.latitude},${business.longitude}` : `${business.name} ${business.address} ${business.city_name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 bg-amber-50/80 hover:bg-amber-100 text-amber-950 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border border-amber-200"
              >
                <Navigation className="w-3.5 h-3.5 text-amber-700" />
                <span>Yandex Xarita</span>
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((business.latitude && business.longitude) ? `${business.latitude},${business.longitude}` : `${business.name} ${business.address} ${business.city_name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                <span>Google Maps</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DEDICATED SECTION: STRUCTURED SERVICE FEATURES & VALUE PROPOSITIONS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-extrabold text-slate-950 tracking-tight">
              {t('key_features_title')}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">NavbatBor Sifat Kafolati</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Feature 1 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-blue-300 transition">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('feature_time_guarantee')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{t('feature_time_guarantee_desc')}</p>
          </div>

          {/* Feature 2 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-emerald-300 transition">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('feature_sterilization')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{t('feature_sterilization_desc')}</p>
          </div>

          {/* Feature 3 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-purple-300 transition">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('feature_specialists')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{t('feature_specialists_desc')}</p>
          </div>

          {/* Feature 4 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-cyan-300 transition">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('feature_equipment')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{t('feature_equipment_desc')}</p>
          </div>

          {/* Feature 5 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-amber-300 transition">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('feature_payment')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{t('feature_payment_desc')}</p>
          </div>

          {/* Feature 6 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-indigo-300 transition">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('feature_tg_reminder')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{t('feature_tg_reminder_desc')}</p>
          </div>
        </div>
      </div>

      {/* 4. PROMINENT PRICING & SERVICE TABLES (Marketplace Product Offerings) */}
      <div id="services-table-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span>{t('pricing_table_title')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Barcha narxlar tasdiqlangan va qo‘shimcha yashirin to‘lovlarsiz amal qiladi
            </p>
          </div>

          {/* Search within services */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Xizmat nomini qidiring..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600 transition"
            />
          </div>
        </div>

        {/* Pricing Table / Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold border-y border-slate-200">
                <th className="py-3 px-4 rounded-l-xl">Xizmat nomi va tavsifi</th>
                <th className="py-3 px-4 text-center">Davomiyligi</th>
                <th className="py-3 px-4 text-right">Narxi (UZS)</th>
                <th className="py-3 px-4 text-center rounded-r-xl">Harakat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Mos keluvchi xizmat topilmadi
                  </td>
                </tr>
              ) : (
                filteredServices.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition group">
                    <td className="py-4 px-4 min-w-[220px]">
                      <div className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition">
                        {s.name}
                      </div>
                      {s.description && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {s.description}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 font-semibold text-[11px]">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{s.duration_minutes} daqiqa</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="font-black text-slate-950 text-sm sm:text-base">
                        {Number(s.price_uzs).toLocaleString('uz-UZ')} UZS
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold">Kafolatlangan narx</span>
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        id={`pricing-book-btn-${s.id}`}
                        onClick={() => {
                          setActiveServiceIdForBooking(s.id);
                          setShowBookingModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer active:scale-[0.98]"
                      >
                        {t('direct_book_action')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. DEDICATED UI SECTION: SEO-OPTIMIZED DESCRIPTIONS IN BOTH UZBEK & RUSSIAN */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-extrabold text-slate-950 tracking-tight">
              {t('seo_desc_title')}
            </h2>
          </div>

          {/* Bilingual Language Switcher for SEO description */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              id="seo-desc-lang-uz-btn"
              onClick={() => setDescLang('uz')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                descLang === 'uz' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🇺🇿</span>
              <span>{t('seo_desc_uz')}</span>
            </button>
            <button
              type="button"
              id="seo-desc-lang-ru-btn"
              onClick={() => setDescLang('ru')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                descLang === 'ru' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🇷🇺</span>
              <span>{t('seo_desc_ru')}</span>
            </button>
          </div>
        </div>

        {/* Structured SEO Narrative Content */}
        <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3 whitespace-pre-line">
          {descLang === 'uz' ? seoDescriptions.uz : seoDescriptions.ru}
        </div>

        {/* SEO Keywords Tags Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-400 font-semibold mr-1">Teglar:</span>
          {[`#${translateCity(business.city_name)}`, `#${translateCategory(business.category_slug || business.category_name)}`, `#${business.name.replace(/\s+/g, '')}`, '#OnlaynNavbat', '#NavbatBor', '#ShifokorQabuli', '#QarshiXizmatlar'].map((tag, i) => (
            <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 6. STAFF & SPECIALISTS SECTION */}
      {staff.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>{t('specialists_title')} ({staff.length})</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">Malakali mutaxassislar qabuli</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((st) => (
              <div key={st.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3 hover:border-blue-300 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-black text-base flex items-center justify-center shrink-0 overflow-hidden border border-blue-200">
                    {st.avatar_url ? (
                      <img
                        src={st.avatar_url}
                        alt={st.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <span className="select-none">{st.name ? st.name.charAt(0).toUpperCase() : 'U'}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-xs truncate">{st.name}</h3>
                    <p className="text-[11px] text-slate-500 truncate">{st.title || 'Mutaxassis'}</p>
                    <span className="text-[10px] text-emerald-700 font-semibold">● Qabulga ochiq</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBookingModal(true)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  Yozilish
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. WORKING HOURS & REVIEWS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Working Hours */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span>{t('working_hours')}</span>
          </h2>

          <div className="space-y-2 text-xs">
            {hours.map((h) => {
              const now = new Date();
              const isToday = now.getDay() === h.day_of_week;
              return (
                <div 
                  key={h.id} 
                  className={`flex items-center justify-between py-2 px-3 rounded-xl transition ${
                    isToday ? 'bg-blue-50/80 border border-blue-200 font-bold text-blue-900' : 'border-b border-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isToday && <span className="w-2 h-2 rounded-full bg-blue-600"></span>}
                    <span>{dayNames[h.day_of_week]}</span>
                    {isToday && <span className="text-[10px] text-blue-600 font-extrabold">(Bugun)</span>}
                  </span>
                  {h.is_closed ? (
                    <span className="text-rose-500 font-bold">{t('closed_day')}</span>
                  ) : (
                    <span className="font-mono">
                      {h.open_time} - {h.close_time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Reviews */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>{t('reviews_title')}</span>
            </h2>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              {Number(business.avg_rating || 5).toFixed(1)} / 5.0
            </span>
          </div>

          {reviews.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p>Hozircha sharhlar mavjud emas.</p>
              <p className="text-[11px] text-slate-500 mt-1">Xizmatdan foydalangandan so‘ng birinchi sharhni siz qoldiring!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {reviews.map((r) => (
                <div key={r.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{r.customer_name || 'Mijoz'}</span>
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[...Array(r.rating || 5)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{r.comment}</p>
                  <span className="text-[10px] text-slate-400 block">{r.created_at || 'Yaqinda'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 8. STICKY MOBILE BOTTOM BOOKING & QUEUE BAR */}
      <div className="sm:hidden fixed bottom-14 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 shadow-xl flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowQueueModal(true)}
          className="flex-1 py-3 bg-amber-400 active:bg-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer border border-amber-500/70"
        >
          <Clock className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          <span>{t('join_queue')}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowBookingModal(true)}
          className="flex-1 py-3 bg-blue-600 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
          <span>{t('book_time')}</span>
        </button>
      </div>

      {/* LIGHTBOX MODAL */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.title || 'Rasm'}
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            aria-label="Yopish"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 text-white text-sm font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full cursor-pointer"
          >
            ✕ Yopish
          </button>
          <img
            src={activePhoto.url}
            alt={activePhoto.title}
            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            referrerPolicy="no-referrer"
          />
          <p className="text-white text-xs font-semibold mt-3 text-center">
            {activePhoto.title}
          </p>
        </div>
      )}

      {/* MODALS */}
      {showBookingModal && (
        <BookingModal
          business={business}
          services={services}
          staff={staff}
          currentUser={currentUser}
          initialServiceId={activeServiceIdForBooking}
          onClose={() => {
            setShowBookingModal(false);
            setActiveServiceIdForBooking(undefined);
          }}
          onSuccess={(b) => {
            onBookingSuccess(b);
          }}
          onGoToBookings={onGoToBookings}
        />
      )}

      {showQueueModal && (
        <QueueModal
          business={business}
          services={services}
          currentUser={currentUser}
          onClose={() => setShowQueueModal(false)}
          onSuccess={() => {
            setReloadKey((k) => k + 1);
          }}
          onOpenAuth={onOpenAuth}
        />
      )}

      {showQRModal && (
        <QRCodeModal business={business} onClose={() => setShowQRModal(false)} />
      )}

      {showQueueBoardModal && (
        <QueueBoardModal
          businessSlug={business.slug}
          businessName={business.name}
          onClose={() => setShowQueueBoardModal(false)}
        />
      )}
    </div>
  );
};
