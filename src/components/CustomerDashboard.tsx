import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, MapPin, AlertCircle, CheckCircle2,
  Star, RefreshCw, ChevronRight,
  Send, Bell, Heart, User as UserIcon, Check,
  Trash2, ExternalLink, History, RotateCcw, CalendarPlus,
  X
} from 'lucide-react';
import { api } from '../api';
import { Booking, User, FavoriteBusiness, NotificationItem } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { ReviewModal } from './ReviewModal';
import { useTimedState } from '../hooks/useTimedState';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useConfirm } from './ui/Dialog';
import { asArray } from '../utils/safe';
import { makePhoneChangeHandler, phoneKeyDownGuard } from '../utils/phoneInput';

interface CustomerDashboardProps {
  currentUser: User;
  onExploreBusinesses: () => void;
  onSelectBusiness?: (business: any) => void;
  onUserUpdate?: (user: User) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  currentUser,
  onExploreBusinesses,
  onSelectBusiness,
  onUserUpdate,
}) => {
  const { t, translateCategory } = useTranslation();
  const [activeTab, setActiveTab] = useState<'bookings' | 'queue' | 'favorites' | 'notifications' | 'profile'>('bookings');
  const [bookingSubTab, setBookingSubTab] = useState<'upcoming' | 'past'>('upcoming');
  
  // Data states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeQueue, setActiveQueue] = useState<any | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('ALL');

  // Customer Profile & Telegram Form
  const [profileName, setProfileName] = useState<string>(currentUser.name || '');
  const [profilePhone, setProfilePhone] = useState<string>(currentUser.phone || '');
  const [profileTelegram, setProfileTelegram] = useState<string>(currentUser.telegram_chat_id || '');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  // Auto-dismissing banners (timers are cleared on unmount).
  const [profileSuccess, showProfileSuccess, clearProfileSuccess] = useTimedState<string>(4000);
  const [profileError, showProfileError, clearProfileError] = useTimedState<string>(5000);
  const [testTgStatus, showTestTgStatus] = useTimedState<string>(4000);
  const [testingTg, setTestingTg] = useState<boolean>(false);
  const [actionError, showActionError] = useTimedState<string>(5000);
  const confirm = useConfirm();

  // Modals state
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Re-booking Modal State
  const [rebookModalOpen, setRebookModalOpen] = useState<boolean>(false);
  const [selectedHistoryBooking, setSelectedHistoryBooking] = useState<Booking | null>(null);
  const [rebookDate, setRebookDate] = useState<string>('');
  const [rebookTime, setRebookTime] = useState<string>('10:00');
  const [rebookingInProgress, setRebookingInProgress] = useState<boolean>(false);
  const [rebookingSuccessData, setRebookingSuccessData] = useState<any | null>(null);
  const [rebookingError, setRebookingError] = useState<string | null>(null);

  useEscapeKey(() => setRescheduleBooking(null), !!rescheduleBooking);
  useEscapeKey(() => setRebookModalOpen(false), rebookModalOpen && !!selectedHistoryBooking);

  // Each section loads independently: one failing endpoint must not blank the dashboard.
  const loadData = async () => {
    setLoading(true);
    try {
      const [bList, qRes, favs, notifs] = await Promise.allSettled([
        api.getCustomerBookings(),
        api.getMyActiveQueue(),
        api.getCustomerFavorites(),
        api.getNotifications(),
      ]);
      const failed: string[] = [];
      if (bList.status === 'fulfilled') setBookings(asArray(bList.value));
      else failed.push('Bronlar');
      if (qRes.status === 'fulfilled') setActiveQueue(qRes.value?.activeQueue ?? null);
      else failed.push('Navbat');
      if (favs.status === 'fulfilled') setFavorites(asArray(favs.value));
      else failed.push('Sevimlilar');
      if (notifs.status === 'fulfilled') setNotifications(asArray(notifs.value));
      else failed.push('Bildirishnomalar');
      if (failed.length > 0) {
        console.error('Customer dashboard: some sections failed', failed);
        showActionError(`Ba’zi bo‘limlar yuklanmadi: ${failed.join(', ')}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    clearProfileSuccess();
    clearProfileError();
    try {
      const res = await api.updateCustomerProfile({
        name: profileName,
        phone: profilePhone,
        telegram_chat_id: profileTelegram,
      });
      if (res.user && onUserUpdate) {
        onUserUpdate(res.user);
      }
      showProfileSuccess(t('saved'));
      if (profileTelegram) {
        api.sendTestTelegram({ chat_id: profileTelegram }).catch(() => {});
      }
    } catch (err: any) {
      showProfileError(err.message || 'Xatolik yuz berdi');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRemoveFavorite = async (businessId: string) => {
    try {
      await api.toggleCustomerFavorite(businessId);
      setFavorites(prev => prev.filter(f => f.id !== businessId));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const handleCancelBooking = async (id: string) => {
    const ok = await confirm({
      title: t('cancel_booking'),
      message: t('confirm_cancel_booking'),
      confirmText: t('cancel_booking'),
      cancelText: t('close'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.cancelBooking(id, 'Cancelled by customer');
      loadData();
    } catch (err: any) {
      showActionError(err.message || 'Bandlikni bekor qilishda xatolik yuz berdi');
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !newDate || !newTime) return;

    setRescheduleError(null);
    try {
      await api.rescheduleBooking(rescheduleBooking.id, newDate, newTime);
      setRescheduleBooking(null);
      loadData();
    } catch (err: any) {
      setRescheduleError(err.message || 'Error');
    }
  };

  // Google Calendar link generator
  const getGoogleCalendarUrl = (b: Booking) => {
    const title = encodeURIComponent(`${b.service_name} — ${b.business_name}`);
    const details = encodeURIComponent(`NavbatBor: ${b.staff_name}, #${b.booking_number}`);
    const location = encodeURIComponent(b.business_address || '');
    
    const startDate = (b.booking_date || '').replace(/-/g, '');
    const startTime = (b.start_time || '00:00').replace(':', '').slice(0, 4) + '00';
    const endTime = (b.end_time || b.start_time || '00:00').replace(':', '').slice(0, 4) + '00';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}T${startTime}/${startDate}T${endTime}&details=${details}&location=${location}`;
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isPastBooking = (b: Booking) => {
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(b.status)) return true;
    if (b.booking_date < todayStr) return true;
    return false;
  };

  const upcomingBookings = bookings.filter((b) => !isPastBooking(b));
  const pastBookings = bookings.filter((b) => isPastBooking(b));

  const filteredUpcomingBookings = upcomingBookings.filter((b) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'CONFIRMED') return b.status === 'CONFIRMED';
    if (filterStatus === 'PENDING') return b.status === 'PENDING';
    return true;
  });

  const filteredPastBookings = pastBookings.filter((b) => {
    if (historyFilterStatus === 'ALL') return true;
    if (historyFilterStatus === 'COMPLETED') return b.status === 'COMPLETED';
    if (historyFilterStatus === 'CANCELLED') return ['CANCELLED', 'NO_SHOW'].includes(b.status);
    return true;
  });

  const handleOpenRebook = (b: Booking) => {
    setSelectedHistoryBooking(b);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRebookDate(tomorrow.toISOString().slice(0, 10));
    setRebookTime(b.start_time || '10:00');
    setRebookingError(null);
    setRebookingSuccessData(null);
    setRebookModalOpen(true);
  };

  const handleConfirmRebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHistoryBooking || !rebookDate || !rebookTime) return;

    setRebookingInProgress(true);
    setRebookingError(null);
    try {
      const res = await api.createBooking({
        business_id: selectedHistoryBooking.business_id,
        service_id: selectedHistoryBooking.service_id,
        staff_id: selectedHistoryBooking.staff_id,
        booking_date: rebookDate,
        start_time: rebookTime,
        customer_name: currentUser.name,
        customer_phone: currentUser.phone,
      });
      setRebookingSuccessData(res.booking || res);
      await loadData();
    } catch (err: any) {
      setRebookingError(err.message || 'Bron qilishda xatolik yuz berdi');
    } finally {
      setRebookingInProgress(false);
    }
  };

  const unreadNotifsCount = notifications.filter(n => n.is_read === 0).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Title banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('my_cabinet')}</h1>
          <p className="text-sm text-slate-600 mt-1">
            {t('welcome_user', { name: currentUser.name })}
          </p>
        </div>

        <button
          id="customer-explore-btn"
          onClick={onExploreBusinesses}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-2 self-start cursor-pointer"
        >
          <span>{t('search_button')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-6 overflow-x-auto no-scrollbar text-xs">
        {[
          { id: 'bookings', label: t('my_bookings'), icon: Calendar, badge: upcomingBookings.length },
          { id: 'queue', label: t('my_queue'), icon: Clock, badge: activeQueue ? 1 : 0 },
          { id: 'favorites', label: t('favorites'), icon: Heart, badge: favorites.length },
          { id: 'profile', label: t('profile_settings'), icon: UserIcon },
          { id: 'notifications', label: t('notifications'), icon: Bell, badge: unreadNotifsCount, badgeColor: 'bg-rose-500' },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`customer-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap relative cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === tab.id ? 'bg-white text-blue-600' : (tab.badgeColor ? `${tab.badgeColor} text-white` : 'bg-slate-200 text-slate-700')
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MENING BRONLARIM SECTION */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Sub-tab Switcher: Faol bronlar | Bronlar tarixi */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
              <button
                type="button"
                id="subtab-upcoming"
                onClick={() => setBookingSubTab('upcoming')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  bookingSubTab === 'upcoming'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{t('active_bookings')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  bookingSubTab === 'upcoming' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {upcomingBookings.length}
                </span>
              </button>

              <button
                type="button"
                id="subtab-past"
                onClick={() => setBookingSubTab('past')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  bookingSubTab === 'past'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>{t('booking_history')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  bookingSubTab === 'past' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {pastBookings.length}
                </span>
              </button>
            </div>

            {/* Status filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs px-1">
              {bookingSubTab === 'upcoming' ? (
                <>
                  {[
                    { id: 'ALL', label: t('cat_all') },
                    { id: 'CONFIRMED', label: t('status_confirmed') },
                    { id: 'PENDING', label: 'Kutilmoqda' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      id={`upcoming-filter-${f.id.toLowerCase()}`}
                      onClick={() => setFilterStatus(f.id)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                        filterStatus === f.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { id: 'ALL', label: t('cat_all') },
                    { id: 'COMPLETED', label: t('status_completed') },
                    { id: 'CANCELLED', label: t('status_cancelled') },
                  ].map((f) => (
                    <button
                      key={f.id}
                      id={`past-filter-${f.id.toLowerCase()}`}
                      onClick={() => setHistoryFilterStatus(f.id)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                        historyFilterStatus === f.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* SUB-TAB 1: FAOL BRONLAR */}
          {bookingSubTab === 'upcoming' && (
            <div>
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">{t('loading')}</div>
              ) : filteredUpcomingBookings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">Faol bronlar yo‘q</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Hozircha rejalashtirilgan qabullaringiz mavjud emas. Yangi xizmatni bron qilish yoki avvalgi qabullar tarixini ko‘rishingiz mumkin.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={onExploreBusinesses}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      {t('search_button')}
                    </button>
                    {pastBookings.length > 0 && (
                      <button
                        onClick={() => setBookingSubTab('past')}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>{t('booking_history')} ({pastBookings.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredUpcomingBookings.map((b) => (
                    <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                            #{b.booking_number}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                            b.status === 'CONFIRMED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {b.status === 'CONFIRMED' ? t('status_confirmed') : 'Kutilmoqda'}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-base">{b.business_name}</h3>
                        <p className="text-xs text-blue-600 font-bold mt-0.5">{b.service_name}</p>

                        <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-semibold text-slate-800">{b.booking_date}, {b.start_time} - {b.end_time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Mutaxassis: <strong className="text-slate-700">{b.staff_name}</strong></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="line-clamp-1">{b.business_address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-black text-slate-900">
                          {Number(b.total_price_uzs).toLocaleString('uz-UZ')} UZS
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Google Calendar Link */}
                          <a
                            href={getGoogleCalendarUrl(b)}
                            target="_blank"
                            rel="noreferrer"
                            title="Google Calendar"
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          {/* Reschedule */}
                          <button
                            onClick={() => {
                              setRescheduleBooking(b);
                              setNewDate(b.booking_date);
                              setNewTime(b.start_time);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                          >
                            {t('reschedule_booking')}
                          </button>

                          {/* Cancel */}
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer"
                          >
                            {t('cancel_booking')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: BRONLAR TARIXI */}
          {bookingSubTab === 'past' && (
            <div>
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">{t('loading')}</div>
              ) : filteredPastBookings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                  <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">O‘tgan bronlar tarixi yo‘q</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Sizda hali yakunlangan yoki bekor qilingan qabullar mavjud emas.
                  </p>
                  <button
                    onClick={onExploreBusinesses}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    {t('search_button')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPastBookings.map((b) => (
                    <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                            #{b.booking_number}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                            b.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : b.status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {b.status === 'COMPLETED' ? t('status_completed') : b.status === 'CANCELLED' ? t('status_cancelled') : b.status}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">{b.business_name}</h3>
                            <p className="text-xs text-blue-600 font-bold mt-0.5">{b.service_name}</p>
                          </div>

                          {/* Review status */}
                          {b.status === 'COMPLETED' && !b.review_id && (
                            <button
                              onClick={() => setReviewBooking(b)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span>{t('leave_review')}</span>
                            </button>
                          )}
                          {b.status === 'COMPLETED' && b.review_id && (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1 shrink-0">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{b.review_rating}★</span>
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700">Qabul sanasi: {b.booking_date}, {b.start_time} - {b.end_time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Mutaxassis: <strong className="text-slate-700">{b.staff_name}</strong></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="line-clamp-1">{b.business_address}</span>
                          </div>
                        </div>
                      </div>

                      {/* Re-book Action Footer */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-black text-slate-900">
                          {Number(b.total_price_uzs).toLocaleString('uz-UZ')} UZS
                        </div>

                        <button
                          id={`rebook-btn-${b.id}`}
                          onClick={() => handleOpenRebook(b)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t('rebook')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE ELECTRONIC QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {activeQueue ? (
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 md:p-8 text-white shadow-xl shadow-amber-500/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    {t('live_queue')}
                  </div>
                  <h2 className="text-2xl font-black">{activeQueue.business_name}</h2>
                  <p className="text-xs text-white/90">{activeQueue.service_name} • {activeQueue.business_address}</p>
                </div>

                <div className="flex items-center gap-6 bg-black/20 p-5 rounded-2xl backdrop-blur">
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-white/80">{t('your_ticket')}</span>
                    <div className="text-4xl font-black font-mono mt-1">{activeQueue.queue_number}</div>
                  </div>
                  <div className="h-12 w-px bg-white/20" />
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-white/80">{t('people_ahead')}</span>
                    <div className="text-3xl font-bold mt-1">{activeQueue.peopleAhead}</div>
                  </div>
                  <div className="h-12 w-px bg-white/20" />
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-white/80">{t('est_wait_time')}</span>
                    <div className="text-3xl font-bold mt-1">{activeQueue.estimatedWaitMinutes} {t('minute_unit')}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-white" />
                  <span>
                    {activeQueue.telegram_chat_id || currentUser?.telegram_chat_id 
                      ? `Telegram ulangan (${activeQueue.telegram_chat_id || currentUser?.telegram_chat_id}) - Navbat kelganda va oz qolganda bot xabar yuboradi`
                      : 'Telegram ulanmagan — xabarlarni o‘tkazib yubormaslik uchun botni faollashtiring'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://t.me/Navbat1Uzb_bot?start=queue_${activeQueue.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-white text-amber-800 hover:bg-amber-50 rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5 fill-amber-800" />
                    <span>{activeQueue.telegram_chat_id || currentUser?.telegram_chat_id ? 'Botni ochish' : 'Botda faollashtirish (1-bosish)'}</span>
                  </a>
                  <button
                    onClick={loadData}
                    className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('apply')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">{t('no_results')}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('your_turn_desc')}
              </p>
              <button
                onClick={onExploreBusinesses}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {t('search_button')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FAVORITES (SAVED BUSINESSES) */}
      {activeTab === 'favorites' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('favorites')}</h2>
              <p className="text-xs text-slate-500">{t('favorites')}</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{favorites.length}</span>
          </div>

          {favorites.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">{t('no_results')}</h3>
              <button
                onClick={onExploreBusinesses}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {t('search_button')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((fav) => (
                <div key={fav.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-blue-600">{translateCategory(fav.category_slug || fav.category_name)}</span>
                      <button
                        onClick={() => handleRemoveFavorite(fav.id)}
                        title="Delete"
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{fav.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {fav.district ? `${fav.district}, ` : ''}{fav.address}
                    </p>

                    <div className="flex items-center gap-1 text-xs text-amber-500 font-bold mt-2">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{Number(fav.avg_rating || 5).toFixed(1)}</span>
                      <span className="text-slate-400 text-[10px] font-normal">({fav.review_count || 0})</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => onSelectBusiness && onSelectBusiness(fav)}
                      className="w-full py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {t('book_time')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('notifications')}</h2>
              <p className="text-xs text-slate-500">{t('notifications')}</p>
            </div>
            {unreadNotifsCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                {t('mark_all_read')}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">{t('no_results')}</h3>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkNotificationRead(notif.id)}
                  className={`p-4 flex items-start justify-between gap-4 transition cursor-pointer ${
                    notif.is_read === 0 ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      notif.is_read === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{notif.title}</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 inline-block">
                        {notif.created_at ? notif.created_at.slice(0, 16) : ''}
                      </span>
                    </div>
                  </div>

                  {notif.is_read === 0 && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-2"></span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PROFILE & SETTINGS */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-2xl">
          <h2 className="text-base font-bold text-slate-900 mb-1">{t('profile_settings')}</h2>
          <p className="text-xs text-slate-500 mb-6">{t('telegram_bot')}</p>

          {profileSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {actionError && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">{t('full_name')}</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl p-2.5 focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">{t('phone_number')}</label>
              <input
                type="tel"
                value={profilePhone}
                onChange={makePhoneChangeHandler(setProfilePhone)}
                onKeyDown={phoneKeyDownGuard}
                placeholder="+998"
                className="w-full border border-slate-300 rounded-xl p-2.5 focus:outline-blue-600"
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold text-slate-700 uppercase flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#0088cc]" />
                  <span>{t('telegram_bot')}</span>
                </label>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  profileTelegram ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {profileTelegram ? 'Faol / Ulangan' : 'Ulanmagan'}
                </span>
              </div>

              {/* 1-Click Bot Connect Banner */}
              <div className="p-3.5 bg-gradient-to-r from-[#2AABEE]/10 to-indigo-50 border border-[#2AABEE]/30 rounded-2xl mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-[#0088cc] fill-[#0088cc]" />
                    <span>Telegram Bot: @Navbat1Uzb_bot</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {t('telegram_bot')}
                  </p>
                </div>
                <button
                  type="button"
                  id="customer-connect-tg-btn"
                  onClick={async () => {
                    try {
                      const res = await api.generateTelegramLinkToken();
                      if (res.deepLink) {
                        window.location.href = res.deepLink;
                      }
                    } catch (e: any) {
                      showProfileError(e.message || 'Telegram xatosi');
                    }
                  }}
                  className="px-4 py-2 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 fill-white" />
                  <span>Telegram botga ulash</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-500">
                  Telegram Chat ID:
                </label>
                <input
                  type="text"
                  value={profileTelegram}
                  onChange={(e) => setProfileTelegram(e.target.value)}
                  placeholder="Chat ID (masalan: 987654321)"
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-mono text-xs focus:outline-blue-600"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                <p className="text-[11px] text-slate-500">
                  Botga <code>/navbat</code> buyrug‘ini yuboring
                </p>
                {profileTelegram && (
                  <button
                    type="button"
                    disabled={testingTg}
                    onClick={async () => {
                      setTestingTg(true);
                      try {
                        await api.sendTestTelegram({ chat_id: profileTelegram });
                        showTestTgStatus('Xabar yuborildi!', 3500);
                      } catch (err: any) {
                        showTestTgStatus('Xatolik: ' + (err.message || 'Yuborilmadi'), 4000);
                      } finally {
                        setTestingTg(false);
                      }
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline self-start sm:self-auto cursor-pointer"
                  >
                    {testingTg ? 'Yuborilmoqda...' : testTgStatus ? testTgStatus : 'Sinov xabarini tekshirish'}
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {savingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{savingProfile ? t('loading') : t('save')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">{t('reschedule_booking')}</h3>
            <p className="text-xs text-slate-500 mb-4">{rescheduleBooking.business_name} — {rescheduleBooking.service_name}</p>

            {rescheduleError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rescheduleError}</span>
              </div>
            )}

            <form onSubmit={handleReschedule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('date_and_time')}</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('date_and_time')}</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleBooking(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSuccess={() => {
            setReviewBooking(null);
            loadData();
          }}
        />
      )}

      {/* 1-Click Quick Re-book Modal */}
      {rebookModalOpen && selectedHistoryBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-blue-200" />
                <h3 className="font-extrabold text-base">{t('rebook_modal_title')}</h3>
              </div>
              <button aria-label="Yopish"
                onClick={() => setRebookModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {rebookingSuccessData ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900 mb-1">{t('rebook_success')}</h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Qabulingiz muvaffaqiyatli ro‘yxatga olindi.
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left mb-6 space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="text-slate-500">Bron raqami:</span>
                      <strong className="font-mono text-blue-600 font-extrabold text-sm">
                        #{rebookingSuccessData.booking_number}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Muassasa:</span>
                      <strong className="text-slate-800">{selectedHistoryBooking.business_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Xizmat:</span>
                      <strong className="text-slate-800">{selectedHistoryBooking.service_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Sana va vaqt:</span>
                      <strong className="text-slate-800">{rebookingSuccessData.booking_date || rebookDate}, {rebookingSuccessData.start_time || rebookTime}</strong>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setRebookModalOpen(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      {t('close')}
                    </button>
                    <button
                      onClick={() => {
                        setRebookModalOpen(false);
                        setBookingSubTab('upcoming');
                      }}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                    >
                      {t('active_bookings')}ga o‘tish
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmRebook} className="space-y-4">
                  {/* Summary of past appointment */}
                  <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Muassasa:</span>
                      <strong className="text-slate-900 font-bold">{selectedHistoryBooking.business_name}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Xizmat:</span>
                      <strong className="text-blue-700 font-bold">{selectedHistoryBooking.service_name}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Mutaxassis:</span>
                      <strong className="text-slate-800">{selectedHistoryBooking.staff_name}</strong>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-blue-200/60">
                      <span className="text-slate-600 font-medium">Xizmat narxi:</span>
                      <strong className="text-slate-900 font-extrabold">{Number(selectedHistoryBooking.total_price_uzs).toLocaleString('uz-UZ')} UZS</strong>
                    </div>
                  </div>

                  {rebookingError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{rebookingError}</span>
                    </div>
                  )}

                  {/* Date Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">Qabul sanasini tanlang:</label>
                      <span className="text-[10px] text-slate-400">Yangi sana</span>
                    </div>

                    {/* Quick date presets */}
                    <div className="grid grid-cols-3 gap-1.5 mb-2 text-xs">
                      {[
                        { label: 'Bugun', offset: 0 },
                        { label: 'Ertaga', offset: 1 },
                        { label: 'Indinga', offset: 2 },
                      ].map((item) => {
                        const d = new Date();
                        d.setDate(d.getDate() + item.offset);
                        const isoStr = d.toISOString().slice(0, 10);
                        const isSelected = rebookDate === isoStr;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setRebookDate(isoStr)}
                            className={`py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                              isSelected 
                                ? 'bg-blue-600 text-white shadow-2xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="date"
                      value={rebookDate}
                      min={todayStr}
                      onChange={(e) => setRebookDate(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-blue-600"
                    />
                  </div>

                  {/* Time Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">Qulay vaqtni tanlang:</label>
                      <span className="text-[10px] text-slate-400">Boshlanish vaqti</span>
                    </div>

                    {/* Quick time slots */}
                    <div className="grid grid-cols-4 gap-1.5 mb-2 text-xs">
                      {['09:00', '11:00', '14:00', '16:00'].map((timeSlot) => {
                        const isSelected = rebookTime === timeSlot;
                        return (
                          <button
                            key={timeSlot}
                            type="button"
                            onClick={() => setRebookTime(timeSlot)}
                            className={`py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                              isSelected 
                                ? 'bg-blue-600 text-white shadow-2xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {timeSlot}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="time"
                      value={rebookTime}
                      onChange={(e) => setRebookTime(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-blue-600"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRebookModalOpen(false)}
                      disabled={rebookingInProgress}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={rebookingInProgress || !rebookDate || !rebookTime}
                      className="flex-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {rebookingInProgress ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Band qilinmoqda...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>Qayta bron qilish</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
