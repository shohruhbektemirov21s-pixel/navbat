import React from 'react';
import { ArrowRight, CalendarCheck2, Check, MapPin, Navigation, QrCode, Search, ShieldCheck } from 'lucide-react';
import { City } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface Props {
  cities: City[]; city: string; query: string;
  onCity: (id: string) => void; onQuery: (query: string) => void;
  onSearch: (event: React.FormEvent) => void; onGps: () => void; onScan: () => void;
  gpsLoading: boolean; gpsActive: boolean; notice: string | null; error: string | null;
  onConnectBusiness: () => void;
}
export function LandingHero({ cities, city, query, onCity, onQuery, onSearch, onGps, onScan, gpsLoading, gpsActive, notice, error, onConnectBusiness }: Props) {
  const { t, translateCity } = useTranslation();
  return (
    <section className="landing-hero border-b border-slate-200 bg-[#f1f5fc]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20 grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-center">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-blue-700 text-xs font-bold tracking-wide mb-5"><span className="w-2 h-2 rounded-full bg-blue-600" /> VAQTINGIZNI QADRLAYMIZ</div>
          <h1 className="text-[2.15rem] sm:text-5xl lg:text-[3.5rem] leading-[1.12] font-bold tracking-[-0.045em] text-slate-950">Navbat kutmang.<br /><span className="text-blue-600">Vaqtingizni band qiling.</span></h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-lg leading-relaxed">Klinika, salon va boshqa xizmatlarni toping. O‘zingizga qulay vaqtda, ortiqcha kutishsiz.</p>
          <form onSubmit={onSearch} className="hero-search mt-7 bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/50 p-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <label className="flex items-center gap-3 px-3 min-h-12 sm:col-span-2"><Search size={21} className="text-slate-400 shrink-0" /><span className="sr-only">Biznes yoki xizmat qidirish</span><input id="main-search-input" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Biznes yoki xizmat qidirish" className="w-full min-w-0 bg-transparent text-base outline-none text-slate-900 placeholder:text-slate-400" /></label>
            <label className="flex items-center gap-2 px-3 border-t sm:border-t-0 border-slate-100 min-h-12"><MapPin size={18} className="text-blue-600 shrink-0" /><span className="sr-only">Shahar</span><select id="hero-city-select" value={city} onChange={(event) => onCity(event.target.value)} className="w-full bg-transparent text-sm text-slate-700 outline-none"><option value="">Barcha shaharlar</option>{cities.map((item) => <option key={item.id} value={item.id}>{translateCity(item.name)}</option>)}</select></label>
            <button id="hero-search-btn" type="submit" className="primary-button flex items-center justify-center gap-2 px-6">Xizmat topish <ArrowRight size={18} /></button>
          </form>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button id="hero-gps-btn" type="button" disabled={gpsLoading} onClick={onGps} className={`hero-utility ${gpsActive ? 'text-blue-700 bg-blue-100' : 'text-slate-600 bg-white/60'}`}><Navigation size={16} />{gpsLoading ? t('detecting_gps') : t('near_me')}</button>
            <button id="hero-scan-qr-btn" type="button" onClick={onScan} className="hero-utility bg-white/60 text-slate-600"><QrCode size={17} />{t('scan_qr')}</button>
          </div>
          {(notice || error) && <p role="status" className={`text-sm mt-3 ${error ? 'text-amber-800' : 'text-blue-700'}`}>{error || notice}</p>}
          <div className="flex items-center gap-2 text-sm text-slate-600 mt-6"><ShieldCheck size={18} className="text-emerald-700 shrink-0" />Tekshirilgan bizneslar. Qulay va xavfsiz qabul.</div>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-4 text-sm">
            <span className="text-slate-600">Biznes egasimisiz?</span>
            <button id="hero-connect-business-btn" type="button" onClick={onConnectBusiness} className="inline-flex min-h-11 items-center gap-2 font-semibold text-blue-700 hover:text-blue-900">Biznesingizni qo‘shing <ArrowRight size={16} /></button>
          </div>
        </div>
        <div className="hidden lg:block relative pl-8" aria-label="Navbat olish tartibi">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-6"><div className="w-12 h-12 bg-blue-50 text-blue-600 flex items-center justify-center rounded-2xl"><CalendarCheck2 size={24} /></div><div><p className="text-lg font-bold">Qabulga yozilish oson</p><p className="text-sm text-slate-500 mt-1">Hammasi bir joyda</p></div></div>
            <ol className="mt-7 space-y-6">{[
              ['Xizmatni tanlang', 'Yaqin atrofdagi bizneslarni solishtiring.'],
              ['Qulay vaqtni belgilang', 'Bo‘sh vaqtlar orasidan o‘zingizga mosini oling.'],
              ['Qabulga boring', 'Bron va navbatingizni shaxsiy kabinetingizda kuzating.'],
            ].map(([title, description], index) => <li key={title} className="flex gap-4"><span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm ${index === 2 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>{index === 2 ? <Check size={18} /> : `0${index + 1}`}</span><div><p className="font-semibold text-slate-900">{title}</p><p className="text-sm leading-relaxed text-slate-500 mt-1">{description}</p></div></li>)}</ol>
          </div>
        </div>
      </div>
    </section>
  );
}
