import React, { useState } from 'react';
import { 
  X, Building2, MapPin, Phone, AlertCircle, Clock, 
  Plus, Trash2, CheckCircle2, User as UserIcon, Lock, Mail, DollarSign, Navigation
} from 'lucide-react';
import { api, setStoredToken } from '../api';
import { Category, City, User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface ServiceItemInput {
  name: string;
  duration_minutes: number;
  price_uzs: number;
  description: string;
}

interface BusinessOnboardingModalProps {
  currentUser: User | null;
  categories: Category[];
  cities: City[];
  onClose: () => void;
  onSuccess: (business: any, user?: User) => void;
  onOpenAuth: () => void;
}

export const BusinessOnboardingModal: React.FC<BusinessOnboardingModalProps> = ({
  currentUser,
  categories,
  cities,
  onClose,
  onSuccess,
  onOpenAuth,
}) => {
  const { t, translateCategory, translateCity } = useTranslation();
  // Business core info
  const [name, setName] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || 'cat-stomatology');
  const [cityId, setCityId] = useState<string>(
    cities.find(c => c.name.toLowerCase().includes('qarshi'))?.id || cities[0]?.id || 'city-qarshi'
  );
  const [district, setDistrict] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>(currentUser?.phone || '+998');
  const [description, setDescription] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsLocating, setGpsLocating] = useState<boolean>(false);

  // Working Hours
  const [openTime, setOpenTime] = useState<string>('09:00');
  const [closeTime, setCloseTime] = useState<string>('18:00');
  const [workDaysType, setWorkDaysType] = useState<'MON_SAT' | 'ALL_DAYS' | 'WEEKDAYS'>('MON_SAT');

  // Services offered
  const [services, setServices] = useState<ServiceItemInput[]>([
    { name: 'Asosiy xizmat / Konsultatsiya', duration_minutes: 30, price_uzs: 50000, description: '' }
  ]);

  // Account creation for unauthenticated user
  const [ownerName, setOwnerName] = useState<string>(currentUser?.name || '');
  const [ownerEmail, setOwnerEmail] = useState<string>(currentUser?.email || '');
  const [ownerPassword, setOwnerPassword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedBusiness, setSubmittedBusiness] = useState<any | null>(null);

  const handleAddService = () => {
    setServices(prev => [
      ...prev,
      { name: '', duration_minutes: 30, price_uzs: 50000, description: '' }
    ]);
  };

  const handleRemoveService = (index: number) => {
    if (services.length <= 1) return;
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateService = (index: number, field: keyof ServiceItemInput, val: any) => {
    setServices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Biznes nomini kiriting');
      return;
    }
    if (!address.trim()) {
      setError('Aniq manzilni kiriting');
      return;
    }
    if (!phone || phone.length < 9) {
      setError('To‘g‘ri telefon raqamini kiriting');
      return;
    }

    const validServices = services.filter(s => s.name.trim() !== '');
    if (validServices.length === 0) {
      setError('Kamida bitta xizmat nomini kiriting');
      return;
    }

    if (!currentUser) {
      if (!ownerName.trim()) {
        setError('Biznes egasi ism-familiyasini kiriting');
        return;
      }
      if (!ownerEmail.trim()) {
        setError('Biznes egasi email manzilini kiriting');
        return;
      }
      if (!ownerPassword || ownerPassword.length < 6) {
        setError('Parol kamida 6 belgidan iborat bo‘lishi kerak');
        return;
      }
    }

    setLoading(true);

    // Work days mapping: 0 (Sun), 1 (Mon), 2 (Tue), 3 (Wed), 4 (Thu), 5 (Fri), 6 (Sat)
    let workDays = [1, 2, 3, 4, 5, 6];
    if (workDaysType === 'ALL_DAYS') {
      workDays = [0, 1, 2, 3, 4, 5, 6];
    } else if (workDaysType === 'WEEKDAYS') {
      workDays = [1, 2, 3, 4, 5];
    }

    try {
      const res = await api.registerBusiness({
        name,
        category_id: categoryId,
        city_id: cityId,
        district,
        address,
        phone,
        description,
        open_time: openTime,
        close_time: closeTime,
        work_days: workDays,
        services: validServices,
        owner_name: ownerName,
        owner_email: ownerEmail,
        owner_password: ownerPassword,
        owner_phone: phone,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      });

      if (res.token) {
        setStoredToken(res.token);
      }

      setSubmittedBusiness(res.business);
      onSuccess(res.business, res.user);
    } catch (err: any) {
      setError(err.message || 'Biznesni ro‘yxatdan o‘tkazishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
        <button
          id="close-onboard-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {submittedBusiness ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Arizangiz muvaffaqiyatli qabul qilindi!</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                <strong className="text-slate-900">{submittedBusiness.name}</strong> muassasasi NavbatBor tizimiga topshirildi.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 text-left space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Tekshiruv Holati: MODERATOR TASDIG‘I KUTILMOQDA (PENDING)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Platforma administratori ma’lumotlarni ko‘rib chiqadi va tez orada arizani tasdiqlaydi. Tasdiqlanganidan so‘ng muassasangiz Qarshi shahri katalogida e’lon qilinadi va mijozlar to‘g‘ridan-to‘g‘ri bron qilishni boshlaydilar.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 text-left space-y-1">
              <div><strong>Biznes nomi:</strong> {submittedBusiness.name}</div>
              <div><strong>Holat:</strong> <span className="px-2 py-0.5 rounded font-black text-[10px] bg-amber-100 text-amber-800">PENDING</span></div>
              <div><strong>Ish vaqti:</strong> {openTime} - {closeTime}</div>
              <div><strong>Xizmatlar soni:</strong> {services.filter(s => s.name.trim()).length} ta</div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Tushundim, rahmat!
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Biznesingizni NavbatBor’ga ulang</h3>
                <p className="text-xs text-slate-500">Mijozlar oqimi, xodimlar jadvali va onlayn bronlarni avtomatlashtiring</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 text-xs">
              {/* 1. Asosiy Ma'lumotlar */}
              <div className="space-y-3">
                <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
                  1. Muassasa Ma’lumotlari
                </h4>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Biznes / Filial Nomi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="onboard-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Masalan: Nasaf Dental Care yoki Qarshi Auto Service"
                    required
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Xizmat Kategoriyasi</label>
                    <select
                      id="onboard-category-select"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {translateCategory(c.slug || c.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Aloqa Telefoni <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="onboard-phone-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998752210000"
                      required
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Manzil */}
              <div className="space-y-3">
                <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
                  2. Joylashuv & Manzil
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t('select_city')}</label>
                    {cities.length <= 1 ? (
                      <div className="w-full border border-blue-200 rounded-xl px-3.5 py-2.5 bg-blue-50/50 font-semibold text-slate-800 flex items-center justify-between text-sm">
                        <span>{cities[0] ? translateCity(cities[0].name) : 'Qarshi'}</span>
                        <span className="text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-bold">Qarshi shahri</span>
                      </div>
                    ) : (
                      <select
                        id="onboard-city-select"
                        value={cityId}
                        onChange={(e) => setCityId(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      >
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {translateCity(c.name)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tuman / Hudud</label>
                    <input
                      type="text"
                      id="onboard-district-input"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Markaz, Nasaf, Beshkent yo‘li..."
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Aniq Manzil / Mo‘ljal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="onboard-address-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Mustaqillik shoh ko‘chasi, 12-uy (Markaziy bank ro‘parasida)"
                    required
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mt-1.5 text-xs">
                    <span className="text-slate-500 text-[11px]">
                      {latitude && longitude ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>GPS aniqlandi ({latitude.toFixed(4)}, {longitude.toFixed(4)})</span>
                        </span>
                      ) : (
                        'Mijozlar sizni xaritada va eng yaqinlar ro‘yxatida oson topishi uchun'
                      )}
                    </span>
                    <button
                      type="button"
                      id="onboard-gps-btn"
                      onClick={() => {
                        if (!('geolocation' in navigator)) return;
                        setGpsLocating(true);
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setLatitude(pos.coords.latitude);
                            setLongitude(pos.coords.longitude);
                            setGpsLocating(false);
                          },
                          () => setGpsLocating(false),
                          { enableHighAccuracy: true, timeout: 8000 }
                        );
                      }}
                      className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto text-[11px] bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>{gpsLocating ? 'Aniqlanmoqda...' : latitude ? 'GPS yangilash' : '📍 Joriy GPS ni aniqlash'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Ish Vaqti */}
              <div className="space-y-3">
                <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>3. Ish Vaqti va Tartibi</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ochilish vaqti</label>
                    <input
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Yopilish vaqti</label>
                    <input
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ish Kunlari</label>
                    <select
                      value={workDaysType}
                      onChange={(e: any) => setWorkDaysType(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="MON_SAT">Dushanba - Shanba (6 kun)</option>
                      <option value="ALL_DAYS">Har kuni (7 kun)</option>
                      <option value="WEEKDAYS">Dushanba - Juma (5 kun)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Taklif Etiladigan Xizmatlar va Narxlari */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    4. Taklif Etiladigan Xizmatlar & Narxlari
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Xizmat qo‘shish</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {services.map((srv, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-500 text-[10px]">Xizmat #{idx + 1}</span>
                        {services.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveService(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                            title="O‘chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-6">
                          <input
                            type="text"
                            value={srv.name}
                            onChange={(e) => handleUpdateService(idx, 'name', e.target.value)}
                            placeholder="Xizmat nomi (masalan: Tish oqartirish)"
                            required
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <select
                            value={srv.duration_minutes}
                            onChange={(e) => handleUpdateService(idx, 'duration_minutes', Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs cursor-pointer focus:outline-none"
                          >
                            <option value={15}>15 daqiqa</option>
                            <option value={30}>30 daqiqa</option>
                            <option value={45}>45 daqiqa</option>
                            <option value={60}>60 daqiqa</option>
                            <option value={90}>90 daqiqa</option>
                            <option value={120}>2 soat</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              step={5000}
                              value={srv.price_uzs}
                              onChange={(e) => handleUpdateService(idx, 'price_uzs', Number(e.target.value))}
                              placeholder="Narxi"
                              required
                              className="w-full bg-white border border-slate-300 rounded-xl pl-3 pr-10 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                              UZS
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Biznes egasi akkaunti (faqat agar tizimga kirmagan bo'lsa) */}
              {!currentUser && (
                <div className="space-y-3 pt-2 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
                  <h4 className="font-black text-indigo-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>5. Biznes Egasi Akkaunti (Tizimga Kirish Uchun)</span>
                  </h4>
                  <p className="text-[11px] text-indigo-800">
                    Arizangiz tasdiqlangach, ushbu email va parol orqali biznes boshqaruv kabinetiga kirishingiz mumkin bo‘ladi.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Ism-familiyangiz</label>
                      <input
                        type="text"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="Jasur Rahimov"
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Email manzili</label>
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="biznes@domain.uz"
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Xavfsiz Parol</label>
                      <input
                        type="password"
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Kamida 6 belgi"
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  id="submit-onboard-btn"
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  <span>{loading ? 'Arizangiz topshirilmoqda...' : 'Biznesni Ro‘yxatdan O‘tkazish (Arizani Yuborish)'}</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  Arizangiz yuborilgach, platforma ma’muri tekshirib tasdiqlaydi.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
