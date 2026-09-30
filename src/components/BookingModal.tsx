import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, User, Check, AlertCircle, Sparkles, CheckCircle2, Send, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../api';
import { Service, StaffMember, User as UserType } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import {
  getTashkentNow,
  isSlotBookable,
  filterAvailableSlots,
  getNextDayStr,
  formatDateUz,
} from '../utils/bookingAvailability';

interface BookingModalProps {
  business: any;
  services: Service[];
  staff: StaffMember[];
  currentUser: UserType | null;
  initialServiceId?: string;
  onClose: () => void;
  onSuccess: (booking: any) => void;
  onOpenAuth: () => void;
  onGoToBookings?: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  business,
  services,
  staff,
  currentUser,
  initialServiceId,
  onClose,
  onSuccess,
  onOpenAuth,
  onGoToBookings,
}) => {
  const { t, lang } = useTranslation();
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    initialServiceId && services.some(s => s.id === initialServiceId) 
      ? initialServiceId 
      : (services[0]?.id || '')
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0]?.id || '');
  
  // Real-time Asia/Tashkent current date
  const tashkentNow = getTashkentNow();
  const todayStr = tashkentNow.dateStr;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [rawSlots, setRawSlots] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotReason, setSlotReason] = useState<string | null>(null);
  const [suggestedDate, setSuggestedDate] = useState<string | null>(null);
  const [suggestedDateFormatted, setSuggestedDateFormatted] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  // Customer details
  const [customerName, setCustomerName] = useState<string>(currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser?.phone || '+998');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookedResult, setBookedResult] = useState<any | null>(null);
  const [bookingMeta, setBookingMeta] = useState<any | null>(null);
  const [sendingToTg, setSendingToTg] = useState<boolean>(false);
  const [tgSentMessage, setTgSentMessage] = useState<string | null>(null);
  const [customTgInput, setCustomTgInput] = useState<string>(currentUser?.telegram_chat_id || '');
  const [showTgInput, setShowTgInput] = useState<boolean>(false);

  const handleSendVoucherToTelegram = async () => {
    if (!bookedResult) return;
    setSendingToTg(true);
    setTgSentMessage(null);
    try {
      const res = await api.sendBookingVoucherToTelegram(bookedResult.id, customTgInput || currentUser?.telegram_chat_id);
      setTgSentMessage(res.message || 'Telegram: OK');
    } catch (err: any) {
      if (err.message && err.message.includes('Chat ID')) {
        setShowTgInput(true);
      }
      setTgSentMessage(err.message || 'Error');
    } finally {
      setSendingToTg(false);
    }
  };

  // Filter staff matching selected service
  const filteredStaff = staff.filter((s) => {
    if (!s.service_ids) return true;
    return s.service_ids.split(',').includes(selectedServiceId);
  });

  // Ensure selected staff is valid for the service
  useEffect(() => {
    if (filteredStaff.length > 0 && !filteredStaff.some((s) => s.id === selectedStaffId)) {
      setSelectedStaffId(filteredStaff[0].id);
    }
  }, [selectedServiceId, filteredStaff, selectedStaffId]);

  // Load available slots from server whenever date, staff, or service changes
  useEffect(() => {
    if (!business?.id || !selectedDate || !selectedStaffId || !selectedServiceId) return;

    setLoadingSlots(true);
    setSlotReason(null);
    setSelectedTime('');

    api.getAvailableSlots(business.id, selectedDate, selectedStaffId, selectedServiceId)
      .then((res: any) => {
        const fetchedRaw = res.slots || [];
        setRawSlots(fetchedRaw);

        // Strict real-time filter: Asia/Tashkent future slots with notice
        const filtered = filterAvailableSlots(fetchedRaw, selectedDate, { minNoticeMinutes: 30 });
        setAvailableSlots(filtered);

        const currentTashkentDate = getTashkentNow().dateStr;
        if (filtered.length === 0 && selectedDate === currentTashkentDate) {
          setSlotReason(res.reason || 'Bugun bo‘sh vaqt qolmagan');
          const nextDay = res.suggested_date || getNextDayStr(selectedDate);
          setSuggestedDate(nextDay);
          setSuggestedDateFormatted(res.suggested_date_formatted || formatDateUz(nextDay));
        } else {
          setSlotReason(res.reason || null);
          setSuggestedDate(res.suggested_date || null);
          setSuggestedDateFormatted(res.suggested_date_formatted || null);
        }
      })
      .catch((err) => {
        console.error('Error fetching slots:', err);
        setRawSlots([]);
        setAvailableSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [business?.id, selectedDate, selectedStaffId, selectedServiceId]);

  // Real-time slot availability recalculator (every 15 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (rawSlots.length === 0) return;
      const valid = filterAvailableSlots(rawSlots, selectedDate, { minNoticeMinutes: 30 });
      setAvailableSlots(valid);

      // If user had picked a slot that just lapsed into the past
      if (selectedTime && !valid.includes(selectedTime)) {
        setSelectedTime('');
        setErrorMessage('Tanlangan vaqt o‘tib ketdi. Iltimos, boshqa bo‘sh vaqtni tanlang.');
      }

      const currentTashkentDate = getTashkentNow().dateStr;
      if (valid.length === 0 && selectedDate === currentTashkentDate) {
        setSlotReason('Bugun bo‘sh vaqt qolmagan');
        const nextDay = getNextDayStr(selectedDate);
        setSuggestedDate(nextDay);
        setSuggestedDateFormatted(formatDateUz(nextDay));
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [rawSlots, selectedDate, selectedTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) {
      setErrorMessage('Iltimos, qulay vaqtni tanlang');
      return;
    }

    // Verify slot is still valid before submitting
    if (!isSlotBookable(selectedDate, selectedTime, { minNoticeMinutes: 30 })) {
      setErrorMessage('Tanlangan vaqt o‘tib ketgan yoki juda yaqin. Iltimos, kelgusi vaqtni tanlang.');
      setSelectedTime('');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.createBooking({
        business_id: business.id,
        service_id: selectedServiceId,
        staff_id: selectedStaffId,
        booking_date: selectedDate,
        start_time: selectedTime,
        customer_name: customerName,
        customer_phone: customerPhone,
      });

      // Confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      setBookedResult(res.booking);
      setBookingMeta(res);
      onSuccess(res.booking);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('band qilindi') || msg.includes('boshqa mijoz') || msg.includes('409')) {
        setErrorMessage('Bu vaqt hozirgina boshqa mijoz tomonidan band qilindi. Iltimos, boshqa vaqtni tanlang.');
      } else {
        setErrorMessage(msg || 'Bron qilishda xatolik yuz berdi');
      }
      setSelectedTime('');
      // Immediately refresh available slots from server to remove booked slot
      if (business?.id && selectedDate && selectedStaffId && selectedServiceId) {
        setLoadingSlots(true);
        api.getAvailableSlots(business.id, selectedDate, selectedStaffId, selectedServiceId)
          .then((res: any) => {
            const fetchedRaw = res.slots || [];
            setRawSlots(fetchedRaw);
            const filtered = filterAvailableSlots(fetchedRaw, selectedDate, { minNoticeMinutes: 30 });
            setAvailableSlots(filtered);
          })
          .catch(() => {})
          .finally(() => setLoadingSlots(false));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const selectedStaffMember = staff.find((s) => s.id === selectedStaffId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl my-8 border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{t('book_time')}</h3>
            <p className="text-xs text-slate-500">{business.name}</p>
          </div>
          <button
            id="close-booking-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {bookedResult ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900">{t('booking_success')}</h4>
              <p className="text-xs text-slate-600 mt-1">
                {t('telegram_bot')}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('booking_number')}:</span>
                <span className="font-mono font-bold text-blue-600 text-sm">{bookedResult.booking_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('services_title')}:</span>
                <span className="font-semibold text-slate-800">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('specialists_title')}:</span>
                <span className="font-semibold text-slate-800">{selectedStaffMember?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('date_and_time')}:</span>
                <span className="font-bold text-slate-900">{bookedResult.booking_date}, {bookedResult.start_time} - {bookedResult.end_time}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">{t('price')}:</span>
                <span className="font-bold text-emerald-600">{Number(bookedResult.total_price_uzs).toLocaleString('uz-UZ')} UZS</span>
              </div>
            </div>

            {/* Telegram Actions Section */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              {/* Telegram Delivery Status Notice */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-left text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Telegram Bildirishnomalari:</span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5 pl-5">
                  <p>
                    🏢 <strong>Biznes egasiga:</strong> Yangi bron haqida avtomatik xabarnoma yuborildi.
                  </p>
                  <p>
                    👤 <strong>Mijozga:</strong> {bookingMeta?.customerTelegramSent ? 'Telegram botingizga tasdiqlovchi chek yuborildi.' : 'Telegram bot orqali chekni saqlab oling.'}
                  </p>
                </div>
              </div>

              {/* Direct 1-Click Bot Access */}
              <a
                href={bookingMeta?.telegramLink || `https://t.me/Navbat1Uzb_bot?start=bkg_${bookedResult.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 fill-white" />
                <span>Telegram Botda Chekni Ko‘rish (@Navbat1Uzb_bot)</span>
              </a>

              {tgSentMessage && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 font-medium ${
                  tgSentMessage.toLowerCase().includes('error') || tgSentMessage.toLowerCase().includes('xatolik')
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{tgSentMessage}</span>
                </div>
              )}

              {showTgInput && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Telegram Chat ID yoki @username"
                    value={customTgInput}
                    onChange={(e) => setCustomTgInput(e.target.value)}
                    className="flex-1 text-xs border border-slate-300 rounded-xl px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleSendVoucherToTelegram}
                    disabled={sendingToTg}
                    className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="send-booking-tg-btn"
                  onClick={handleSendVoucherToTelegram}
                  disabled={sendingToTg}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-slate-600" />
                  <span>{sendingToTg ? t('loading') : 'Qayta yuborish'}</span>
                </button>

                <a
                  id="share-booking-tg-btn"
                  href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(
                    bookedResult ? `📅 "${business.name}" - NavbatBor: ${bookedResult.booking_date}, ${bookedResult.start_time}` : ''
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Ulashish</span>
                </a>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {onGoToBookings && (
                <button
                  id="booking-goto-mybookings-btn"
                  onClick={() => {
                    onClose();
                    onGoToBookings();
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{t('my_bookings')}</span>
                </button>
              )}
              <button
                id="booking-finish-btn"
                onClick={onClose}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                {t('close')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* 1. Xizmat tanlash */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. {t('services_title')}
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {services.map((s) => (
                  <div
                    key={s.id}
                    id={`booking-service-item-${s.id}`}
                    onClick={() => setSelectedServiceId(s.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                      selectedServiceId === s.id
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">{s.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {s.duration_minutes} {t('minute_unit')} {s.description ? `• ${s.description}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-700 text-xs">
                        {Number(s.price_uzs).toLocaleString('uz-UZ')} UZS
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Xodim tanlash */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                2. {t('specialists_title')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {filteredStaff.map((st) => (
                  <div
                    key={st.id}
                    id={`booking-staff-item-${st.id}`}
                    onClick={() => setSelectedStaffId(st.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2.5 ${
                      selectedStaffId === st.id
                        ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs border border-blue-200">
                      {st.avatar_url && !failedAvatars[st.id] ? (
                        <img
                          src={st.avatar_url}
                          alt={st.name}
                          className="w-full h-full object-cover"
                          onError={() => setFailedAvatars((prev) => ({ ...prev, [st.id]: true }))}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-blue-600 text-xs font-bold bg-blue-50">
                          {st.name ? st.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-xs truncate">{st.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{st.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Sana va Bo'sh Vaqtlar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. {t('date_and_time')}
                </label>
                <input
                  type="date"
                  id="booking-date-input"
                  min={todayStr}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {loadingSlots ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {t('loading')}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="py-4 px-3 bg-amber-50/80 border border-amber-200 rounded-xl text-center space-y-2">
                  <div className="text-xs font-bold text-amber-900">
                    {selectedDate === getTashkentNow().dateStr ? 'Bugun bo‘sh vaqt qolmagan' : (slotReason || t('no_results'))}
                  </div>
                  {suggestedDate && (
                    <div className="pt-1">
                      <p className="text-[11px] text-amber-700 mb-2">
                        Keyingi bo‘sh kunga yozilishni tavsiya qilamiz:
                      </p>
                      <button
                        type="button"
                        id="suggested-next-day-btn"
                        onClick={() => setSelectedDate(suggestedDate)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>👉 {suggestedDateFormatted || formatDateUz(suggestedDate)} kuniga o‘tish</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      id={`slot-btn-${slot.replace(':', '-')}`}
                      onClick={() => setSelectedTime(slot)}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-semibold transition cursor-pointer ${
                        selectedTime === slot
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Mijoz ma'lumotlari */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                4. {lang === 'uz' ? 'ISM, FAMILIYA VA TELEFON RAQAMI' : `${t('full_name')} & ${t('phone_number')}`}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  id="booking-customer-name"
                  placeholder={t('full_name')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  id="booking-customer-phone"
                  placeholder="+998901234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  className="text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              id="confirm-booking-btn"
              disabled={submitting || !selectedTime}
              className={`w-full py-3.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition cursor-pointer ${
                submitting || !selectedTime
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-[0.99]'
              }`}
            >
              {submitting ? t('loading') : (t('confirm_booking_btn') || 'Bronni Tasdiqlash')}
            </button>

            {/* Mobile safe-area spacing below confirm button */}
            <div className="h-4 pb-[max(1rem,env(safe-area-inset-bottom,16px))] sm:hidden" aria-hidden="true" />
          </form>
        )}
      </div>
    </div>
  );
};
