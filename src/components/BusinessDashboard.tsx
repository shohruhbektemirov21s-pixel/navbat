import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Calendar as CalendarIcon, Users, Clock, 
  Layers, UserCheck, ShieldCheck, QrCode, DollarSign, 
  CheckCircle, XCircle, AlertCircle, Plus, Search, RefreshCw, Trash2,
  Send, Bell, CreditCard, ShieldAlert, CheckCircle2, Smartphone,
  Tv, CalendarCheck, Megaphone, Eye, MousePointerClick,
  ArrowRight, History, CheckCheck, UserMinus, Sparkles, MessageCircle, ExternalLink, X,
  Lock, Copy
} from 'lucide-react';
import { api } from '../api';
import { User, CRMCustomer, Service, StaffMember } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { QueueBoardModal } from './QueueBoardModal';
import { useTranslation } from '../i18n/LanguageContext';

interface BusinessDashboardProps {
  currentUser: User;
  onOpenOnboarding?: () => void;
}

export const BusinessDashboard: React.FC<BusinessDashboardProps> = ({ currentUser, onOpenOnboarding }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'queue' | 'crm' | 'services' | 'staff' | 'hours' | 'blocked' | 'marketing' | 'subscription' | 'qr'>('overview');
  const [business, setBusiness] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // TV Queue Board & Extra Features
  const [showQueueBoardModal, setShowQueueBoardModal] = useState<boolean>(false);
  const [workingHours, setWorkingHours] = useState<any[]>([]);
  const [savingHours, setSavingHours] = useState<boolean>(false);
  const [hoursSuccess, setHoursSuccess] = useState<string>('');
  const [adAnalytics, setAdAnalytics] = useState<any | null>(null);
  const [promoting, setPromoting] = useState<boolean>(false);
  const [promoSuccess, setPromoSuccess] = useState<string>('');
  const [promoDays, setPromoDays] = useState<number>(7);

  // Subscription & Telegram State (1 Month Validity)
  const [subData, setSubData] = useState<any | null>(null);
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [telegramGroup, setTelegramGroup] = useState<string>('');
  const [savingTelegram, setSavingTelegram] = useState<boolean>(false);
  const [telegramSuccess, setTelegramSuccess] = useState<string>('');
  const [renewing, setRenewing] = useState<boolean>(false);
  const [renewSuccess, setRenewSuccess] = useState<string>('');

  // Telegram Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<any | null>(null);
  const [telegramPaymentLoading, setTelegramPaymentLoading] = useState<boolean>(false);
  const [preparedTelegramMessage, setPreparedTelegramMessage] = useState<string>('');
  const [paymentStep, setPaymentStep] = useState<'preview' | 'sent'>('preview');
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);

  // Tab specific data
  const [calendarBookings, setCalendarBookings] = useState<any[]>([]);
  const [queueEntries, setQueueEntries] = useState<any[]>([]);
  const [currentQueueCustomer, setCurrentQueueCustomer] = useState<any | null>(null);
  const [nextQueueCustomer, setNextQueueCustomer] = useState<any | null>(null);
  const [waitingQueueCount, setWaitingQueueCount] = useState<number>(0);
  const [pendingAction, setPendingAction] = useState<any | null>(null);
  const [pendingCountdown, setPendingCountdown] = useState<number>(60);
  const [requestingNext, setRequestingNext] = useState<boolean>(false);
  const [confirmingFallback, setConfirmingFallback] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);
  const [queueStatusFilter, setQueueStatusFilter] = useState<'ALL' | 'WAITING' | 'CALLED_SERVING' | 'COMPLETED' | 'NO_SHOW'>('ALL');
  const [crmCustomers, setCrmCustomers] = useState<CRMCustomer[]>([]);
  const [crmSearch, setCrmSearch] = useState<string>('');
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  // Blocked Times State
  const [blockedTimes, setBlockedTimes] = useState<any[]>([]);
  const [showAddBlocked, setShowAddBlocked] = useState<boolean>(false);
  const [blockedStaffId, setBlockedStaffId] = useState<string>('');
  const [blockedTitle, setBlockedTitle] = useState<string>('');
  const [blockedStartDate, setBlockedStartDate] = useState<string>('');
  const [blockedStartTime, setBlockedStartTime] = useState<string>('09:00');
  const [blockedEndDate, setBlockedEndDate] = useState<string>('');
  const [blockedEndTime, setBlockedEndTime] = useState<string>('19:00');

  // Cancel & Reschedule Booking Modals in Business Cabinet
  const [cancelBookingTarget, setCancelBookingTarget] = useState<any | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState<string>('');
  const [rescheduleBookingTarget, setRescheduleBookingTarget] = useState<any | null>(null);
  const [bizRescheduleDate, setBizRescheduleDate] = useState<string>('');
  const [bizRescheduleTime, setBizRescheduleTime] = useState<string>('');
  const [bizRescheduleStaffId, setBizRescheduleStaffId] = useState<string>('');
  const [bizActionLoading, setBizActionLoading] = useState<boolean>(false);

  // Modals & Forms
  const [showAddService, setShowAddService] = useState<boolean>(false);
  const [newServiceName, setNewServiceName] = useState<string>('');
  const [newServicePrice, setNewServicePrice] = useState<number>(100000);
  const [newServiceDuration, setNewServiceDuration] = useState<number>(30);
  const [newServiceDesc, setNewServiceDesc] = useState<string>('');

  const [showAddStaff, setShowAddStaff] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffTitle, setNewStaffTitle] = useState<string>('');
  const [newStaffPhone, setNewStaffPhone] = useState<string>('+998');

  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCurrentBusiness = async () => {
    setLoading(true);
    try {
      const res = await api.getCurrentBusiness();
      setBusiness(res.business);
      setStats(res.stats);

      if (res.business) {
        setTelegramChatId(res.business.telegram_chat_id || '');
        setTelegramGroup(res.business.telegram_channel_or_group || '');

        // Load initial tab data & subscription
        const [calRes, qRes, crmRes, srvRes, stfRes, subRes, whRes, adRes, qState, qLogs] = await Promise.all([
          api.getCalendarBookings(),
          api.getBusinessQueue(res.business.id),
          api.getCRMCustomers(),
          api.getBusinessServices(),
          api.getBusinessStaff(),
          api.getBusinessSubscription().catch(() => null),
          api.getBusinessWorkingHours().catch(() => []),
          api.getBusinessAdAnalytics().catch(() => null),
          api.getCurrentQueueState(res.business.id).catch(() => null),
          api.getQueueAuditLogs(res.business.id).catch(() => [])
        ]);
        setCalendarBookings(calRes);
        setQueueEntries(qRes);
        setCrmCustomers(crmRes);
        setServices(srvRes);
        setStaff(stfRes);
        if (subRes) setSubData(subRes);
        if (whRes) setWorkingHours(whRes);
        if (adRes) setAdAnalytics(adRes);
        if (qState) {
          setCurrentQueueCustomer(qState.currentCustomer);
          setNextQueueCustomer(qState.nextCustomer);
          setWaitingQueueCount(qState.waitingCount);
          if (qState.pendingAction) setPendingAction(qState.pendingAction);
        }
        if (qLogs) setAuditLogs(qLogs);
      }
    } catch (err) {
      console.error('Error loading business:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTelegramPayment = (plan: any) => {
    setSelectedPaymentPlan(plan);
    const formattedPrice = `${(plan.price_uzs || 299000).toLocaleString('uz-UZ')} so‘m`;
    // Automatically prepare and display this exact message:
    // “Salom! NavbatBor tarifini sotib olmoqchiman.
    // Biznes: [Business Name]
    // Tarif: [Selected Plan]
    // Narx: [Price]”
    const msg = `Salom! NavbatBor tarifini sotib olmoqchiman.\nBiznes: ${business?.name || 'Mening biznesim'}\nTarif: ${plan.name || plan.code}\nNarx: ${formattedPrice}`;
    setPreparedTelegramMessage(msg);
    setPaymentStep('preview');
    setCopiedMessage(false);
    setPaymentModalOpen(true);
  };

  const handleExecuteTelegramPayment = async () => {
    if (!selectedPaymentPlan) return;
    setTelegramPaymentLoading(true);
    try {
      const res = await api.requestTelegramPayment({ plan_code: selectedPaymentPlan.code });
      const targetUrl = res.telegramUrl || `https://t.me/mansur_0511?text=${encodeURIComponent(preparedTelegramMessage)}`;
      
      // Open Telegram link
      if (typeof window !== 'undefined') {
        window.open(targetUrl, '_blank');
      }

      // Refresh subscription state to get the new PENDING transaction
      const updatedSub = await api.getBusinessSubscription();
      setSubData(updatedSub);
      setPaymentStep('sent');
      showToast('To‘lov so‘rovi yuborildi. Administrator tasdiqlashini kuting.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik yuz berdi', 'error');
    } finally {
      setTelegramPaymentLoading(false);
    }
  };

  const handleRenewSubscription = async (planCode: string = 'PRO') => {
    // Redirect to Telegram payment flow
    const targetPlan = subData?.allPlans?.find((p: any) => p.code === planCode) || {
      code: planCode,
      name: planCode,
      price_uzs: planCode === 'START' ? 149000 : planCode === 'BUSINESS' ? 599000 : 299000
    };
    handleOpenTelegramPayment(targetPlan);
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTelegram(true);
    setTelegramSuccess('');
    try {
      await api.updateBusinessTelegram({
        telegram_chat_id: telegramChatId,
        telegram_channel_or_group: telegramGroup,
        send_test: true
      });
      setTelegramSuccess('Telegram sozlamalari saqlandi va sinov xabari yuborildi!');
      const cur = await api.getCurrentBusiness();
      setBusiness(cur.business);
      showToast('Telegram sozlamalari muvaffaqiyatli saqlandi!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Telegram sozlamalarini saqlashda xatolik', 'error');
    } finally {
      setSavingTelegram(false);
    }
  };

  useEffect(() => {
    loadCurrentBusiness();
  }, []);

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    try {
      await api.updateBookingStatus(bookingId, newStatus);
      const updated = await api.getCalendarBookings();
      setCalendarBookings(updated);
      const cur = await api.getCurrentBusiness();
      setStats(cur.stats);
      showToast('Buyurtma holati yangilandi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik yuz berdi', 'error');
    }
  };

  const handleSendReminder = async (bookingId: string) => {
    setSendingReminderId(bookingId);
    try {
      const res = await api.sendBookingReminder(bookingId);
      showToast(res.message || 'Eslatma muvaffaqiyatli yuborildi!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Eslatma yuborishda xatolik', 'error');
    } finally {
      setSendingReminderId(null);
    }
  };

  const refreshQueueData = async () => {
    if (!business?.id) return;
    try {
      const [entries, qState, logs] = await Promise.all([
        api.getBusinessQueue(business.id).catch(() => []),
        api.getCurrentQueueState(business.id).catch(() => null),
        api.getQueueAuditLogs(business.id).catch(() => [])
      ]);
      setQueueEntries(entries);
      if (qState) {
        setCurrentQueueCustomer(qState.currentCustomer);
        setNextQueueCustomer(qState.nextCustomer);
        setWaitingQueueCount(qState.waitingCount);
        if (qState.pendingAction) setPendingAction(qState.pendingAction);
      }
      if (logs) setAuditLogs(logs);
    } catch (err) {}
  };

  // Real-Time SSE listener for instantaneous queue sync
  useEffect(() => {
    if (!business?.id) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/queue/stream/${business.id}`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'QUEUE_CALLED') {
            setCurrentQueueCustomer(data.called);
            setPendingAction(null);
            showToast(`Navbat #${data.called.queue_number} (${data.called.customer_name}) chaqirildi!`, 'success');
            refreshQueueData();
          } else if (data.type === 'PENDING_ACTION_CREATED') {
            setPendingAction(data);
            setPendingCountdown(60);
          } else if (data.type === 'PENDING_ACTION_CANCELLED') {
            setPendingAction(null);
          } else if (data.type === 'SERVICE_COMPLETED' || data.type === 'CUSTOMER_NO_SHOW' || data.type === 'QUEUE_STATUS_UPDATED') {
            refreshQueueData();
          } else if (data.type === 'CONNECTED') {
            setCurrentQueueCustomer(data.currentCustomer);
            setNextQueueCustomer(data.nextCustomer);
            setWaitingQueueCount(data.waitingCount);
            if (data.pendingAction) setPendingAction(data.pendingAction);
          }
        } catch (e) {}
      };
    } catch (err) {}

    return () => {
      if (es) es.close();
    };
  }, [business?.id]);

  // Polling fallback when pending Telegram confirmation is active
  useEffect(() => {
    if (!pendingAction) return;
    const actionId = pendingAction.id || pendingAction.pendingActionId;
    if (!actionId) return;

    const countdownInterval = setInterval(() => {
      setPendingCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.getPendingQueueStatus(actionId);
        if (res.status === 'CONFIRMED') {
          setPendingAction(null);
          showToast('Telegram orqali tasdiqlandi! Keyingi mijoz chaqirildi.', 'success');
          refreshQueueData();
        } else if (res.status === 'CANCELLED') {
          setPendingAction(null);
          showToast('Keyingi mijozni chaqirish bekor qilindi', 'error');
          refreshQueueData();
        } else if (res.status === 'EXPIRED') {
          setPendingAction(null);
          showToast('Tasdiqlash muddati tugadi', 'error');
          refreshQueueData();
        }
      } catch (e) {}
    }, 2000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(pollInterval);
    };
  }, [pendingAction]);

  const handleCallNextCustomer = async () => {
    if (!business) return;
    setRequestingNext(true);
    try {
      const res = await api.operatorCallNext(business.id);
      showToast(res.message || 'Keyingi mijoz chaqirildi! Telegram orqali xabar yuborildi.', 'success');
      await refreshQueueData();
    } catch (err: any) {
      showToast(err.message || 'Keyingi mijozni chaqirishda xatolik', 'error');
    } finally {
      setRequestingNext(false);
    }
  };

  const handleAcceptCustomer = async (entryId: string) => {
    try {
      await api.operatorAccept(entryId);
      showToast('Mijoz keldi — xizmat ko‘rsatilmoqda (SERVING)', 'success');
      await refreshQueueData();
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleCancelCustomer = async (entryId: string) => {
    try {
      await api.operatorCancel(entryId);
      showToast('Navbat bekor qilindi', 'error');
      await refreshQueueData();
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleRequestNextCustomer = async () => {
    if (!business) return;
    setRequestingNext(true);
    try {
      const res = await api.operatorCallNext(business.id);
      showToast(res.message || 'Keyingi mijoz chaqirildi!', 'success');
      await refreshQueueData();
    } catch (err: any) {
      showToast(err.message || 'Keyingi mijozni chaqirishda xatolik', 'error');
    } finally {
      setRequestingNext(false);
    }
  };

  const handleConfirmFallback = async () => {
    if (!business) return;
    setConfirmingFallback(true);
    try {
      const actionId = pendingAction?.id || pendingAction?.pendingActionId;
      const res = await api.confirmNextCustomer(actionId, business.id);
      setPendingAction(null);
      showToast(res.message || 'Keyingi mijoz chaqirildi!', 'success');
      refreshQueueData();
    } catch (err: any) {
      showToast(err.message || 'Tasdiqlashda xatolik', 'error');
    } finally {
      setConfirmingFallback(false);
    }
  };

  const handleCancelPending = async () => {
    const actionId = pendingAction?.id || pendingAction?.pendingActionId;
    if (!actionId) {
      setPendingAction(null);
      return;
    }
    try {
      await api.cancelPendingQueueAction(actionId);
      setPendingAction(null);
      showToast('Amal bekor qilindi', 'success');
      refreshQueueData();
    } catch (err: any) {
      setPendingAction(null);
    }
  };

  const handleCompleteCurrentCustomer = async (entryId?: string) => {
    if (!business) return;
    try {
      await api.completeQueueService(business.id, entryId);
      showToast('Xizmat muvaffaqiyatli yakunlandi!', 'success');
      refreshQueueData();
    } catch (err: any) {
      showToast(err.message || 'Yakunlashda xatolik', 'error');
    }
  };

  const handleNoShowCustomer = async (entryId: string) => {
    if (!business) return;
    try {
      await api.noShowQueueCustomer(business.id, entryId);
      showToast('Mijoz kelmadi (No-Show) deb belgilandi', 'error');
      refreshQueueData();
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleQueueAction = async (queueId: string, action: 'CALL' | 'SERVE' | 'COMPLETE' | 'SKIP' | 'NO_SHOW') => {
    if (!business) return;
    try {
      await api.queueAction(queueId, action);
      refreshQueueData();
      showToast('Navbat holati yangilandi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBusinessService({
        name: newServiceName,
        price_uzs: newServicePrice,
        duration_minutes: newServiceDuration,
        description: newServiceDesc,
      });
      setShowAddService(false);
      setNewServiceName('');
      const updated = await api.getBusinessServices();
      setServices(updated);
      showToast('Yangi xizmat qo‘shildi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (!window.confirm('Ushbu xizmatni o‘chirmoqchimisiz?')) return;
      }
    } catch {
      // Proceed if confirm is blocked by iframe policy
    }
    try {
      await api.deleteBusinessService(id);
      const updated = await api.getBusinessServices();
      setServices(updated);
      showToast('Xizmat o‘chirildi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBusinessStaff({
        name: newStaffName,
        title: newStaffTitle,
        phone: newStaffPhone,
      });
      setShowAddStaff(false);
      setNewStaffName('');
      setNewStaffTitle('');
      const updated = await api.getBusinessStaff();
      setStaff(updated);
      showToast('Yangi xodim qo‘shildi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleSearchCRM = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const results = await api.getCRMCustomers(crmSearch);
      setCrmCustomers(results);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-xs text-slate-400">
        Biznes ma’lumotlari yuklanmoqda...
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Sizda hali tasdiqlangan biznes mavjud emas</h2>
          <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
            Platformada xizmatlaringizni taqdim etish va online bronlarni qabul qilish uchun biznesingizni ro‘yxatdan o‘tkazing yoki tekshiruv tugashini kuting.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            {onOpenOnboarding && (
              <button
                type="button"
                id="biz-dash-onboard-btn"
                onClick={onOpenOnboarding}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Biznesni ro‘yxatdan o‘tkazish
              </button>
            )}
            <button
              type="button"
              id="biz-dash-refresh-btn"
              onClick={loadCurrentBusiness}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Qayta tekshirish</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const daysLeft = subData?.daysLeft ?? 0;
  const isTrial = Boolean(subData?.isTrial || (business?.is_trial && !subData?.isExpired && daysLeft > 0));
  const isExpiringSoon = daysLeft <= 3 && daysLeft > 0;
  const isExpired = Boolean(subData?.isExpired || subData?.business?.subscription_status === 'EXPIRED' || (daysLeft <= 0 && business?.subscription_expires_at));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* 14-Day Free Trial or Expiry Alert Banner */}
      {isTrial && (
        <div className="mb-6 p-4 rounded-2xl border bg-gradient-to-r from-blue-50 via-indigo-50 to-white border-blue-200 text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm flex items-center gap-2">
                <span>14 kunlik bepul sinov faol!</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-600 text-white uppercase">
                  {daysLeft} kun qoldi
                </span>
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Sizning muassasangiz uchun barcha PRO imkoniyatlar 14 kun davomida mutlaqo bepul. Tugash sanasi: <strong>{business.subscription_expires_at ? business.subscription_expires_at.slice(0, 10) : '14 kundan so‘ng'}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('subscription');
              handleOpenTelegramPayment({ code: 'PRO', name: 'PRO', price_uzs: 299000 });
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white transition shrink-0 flex items-center gap-2 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <span>💳 Telegram orqali tarif sotib olish</span>
          </button>
        </div>
      )}

      {isExpired && (
        <div className="mb-6 p-4 rounded-2xl border bg-rose-50 border-rose-200 text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm flex items-center gap-2">
                <span>{business.is_trial ? '14 kunlik bepul sinov muddati tugadi!' : 'Tarif muddati yakunlangan!'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white uppercase">
                  Muddati o‘tgan
                </span>
              </h4>
              <p className="text-xs text-rose-800 mt-0.5">
                Pullik xususiyatlar va yangi bronlarni qabul qilish to‘xtatildi. PRO xizmatlaridan to‘liq foydalanishni davom ettirish uchun tarif rejasini tanlang va Telegram orqali to‘lovni tasdiqlang.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('subscription')}
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white transition shrink-0 flex items-center gap-2 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <CreditCard className="w-4 h-4" />
            <span>💳 Tariflarni ko‘rish va To‘lash</span>
          </button>
        </div>
      )}

      {!isTrial && !isExpired && isExpiringSoon && (
        <div className="mb-6 p-4 rounded-2xl border bg-amber-50 border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm flex items-center gap-2">
                <span>Diqqat: Tarif muddati tugamoqda!</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/80 uppercase">
                  {daysLeft} kun qoldi
                </span>
              </h4>
              <p className="text-xs opacity-90 mt-0.5">
                Sizning tarifingiz tugashiga oz vaqt qoldi ({business.subscription_expires_at ? business.subscription_expires_at.slice(0, 10) : '3 kun ichida'}). Xizmatlar to‘xtab qolmasligi uchun uzaytiring.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('subscription');
              handleOpenTelegramPayment({ code: business.subscription_plan_code || 'PRO', name: business.subscription_plan_code || 'PRO', price_uzs: 299000 });
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shrink-0 flex items-center gap-2 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <CreditCard className="w-4 h-4" />
            <span>💳 Telegram orqali to‘lash</span>
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-xl shrink-0 overflow-hidden">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="w-full h-full object-cover" />
            ) : (
              business.name[0]
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">{business.name}</h1>
              {isTrial ? (
                <>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-black rounded-full uppercase">
                    14 kunlik bepul sinov
                  </span>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-full">
                    Qolgan sinov muddati: {daysLeft} kun
                  </span>
                </>
              ) : (
                <>
                  <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold rounded-full uppercase">
                    {business.subscription_plan_code || 'PRO'} Tarif
                  </span>
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isExpired ? 'bg-rose-100 text-rose-700 border border-rose-200' : isExpiringSoon ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    {isExpired ? 'Muddati tugagan' : `${daysLeft} kun qoldi`}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {business.address} • Tel: {business.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="biz-dash-tv-btn"
            onClick={() => setShowQueueBoardModal(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-indigo-200"
          >
            <Tv className="w-4 h-4 text-indigo-600" />
            <span>TV Tablo (Katta Ekran)</span>
          </button>

          <button
            id="biz-dash-qr-btn"
            onClick={() => setShowQRModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4" />
            <span>Biznes QR Kodi</span>
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-6 overflow-x-auto text-xs no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-1">
        {[
          { id: 'overview', label: t('overview'), icon: BarChart3, isPaid: false },
          { id: 'calendar', label: t('calendar_bookings'), icon: CalendarIcon, isPaid: true },
          { id: 'queue', label: t('live_queue'), icon: Clock, isPaid: true },
          { id: 'crm', label: t('customers_crm'), icon: Users, isPaid: true },
          { id: 'services', label: t('services_title'), icon: Layers, isPaid: true },
          { id: 'staff', label: t('staff_members'), icon: UserCheck, isPaid: true },
          { id: 'hours', label: t('work_schedule'), icon: CalendarCheck, isPaid: true },
          { id: 'marketing', label: t('marketing_ads'), icon: Megaphone, isPaid: true },
          { id: 'subscription', label: t('subscription_plan'), icon: DollarSign, isPaid: false, badge: isExpiringSoon || isExpired },
        ].map((tab) => {
          const Icon = tab.icon;
          const isTabLocked = isExpired && tab.isPaid;
          return (
            <button
              key={tab.id}
              id={`biz-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap relative cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isTabLocked
                  ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isTabLocked && (
                <Lock className="w-3 h-3 text-rose-500 shrink-0" />
              )}
              {tab.badge && (
                <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* LOCKED PAID FEATURES OVERLAY WHEN TRIAL/SUBSCRIPTION EXPIRED */}
      {isExpired && ['calendar', 'queue', 'crm', 'services', 'staff', 'hours', 'marketing'].includes(activeTab) && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-rose-200 p-8 sm:p-14 text-center max-w-xl mx-auto shadow-sm my-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
            <Lock className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 bg-rose-100 text-rose-800 text-[11px] font-black rounded-full uppercase tracking-wider">
            {business?.is_trial ? '14 kunlik bepul sinov tugagan' : 'Tarif muddati yakunlangan'}
          </span>
          <h3 className="text-xl font-black text-slate-900 mt-3">Ushbu funksiya hozirda qulflangan</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
            Sizning 14 kunlik bepul sinov muddatingiz yakunlandi. Xizmatlarni sozlash, xodimlar qo‘shish va navbatlarni boshqarishni davom ettirish uchun NavbatBor tarif rejasini tanlang va Telegram orqali to‘lovni tasdiqlang.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setActiveTab('subscription')}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>💳 Tariflar Sahifasiga O‘tish</span>
            </button>
            <button
              onClick={() => handleOpenTelegramPayment({ code: 'PRO', name: 'PRO', price_uzs: 299000 })}
              className="w-full sm:w-auto px-5 py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>💳 Telegram orqali to‘lash</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bugungi Bronlar</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats?.today_bookings || 0}</div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">Real vaqtda</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tasdiqlangan</span>
              <div className="text-2xl font-black text-blue-600 mt-1">{stats?.confirmed_count || 0}</div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">Kutilmoqda</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Yakunlangan</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{stats?.completed_count || 0}</div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">Muvaffaqiyatli</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jami Tushum</span>
              <div className="text-2xl font-black text-indigo-700 mt-1">
                {Number(stats?.total_revenue_uzs || 0).toLocaleString('uz-UZ')}
                <span className="text-xs font-normal text-slate-500 ml-1">UZS</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">Yakunlangan bronlardan</span>
            </div>
          </div>

          {/* Quick preview of upcoming bookings & queue */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Yaqinlashayotgan Bronlar</h3>
                <button onClick={() => setActiveTab('calendar')} className="text-xs text-indigo-600 hover:underline">
                  Barchasini ko‘rish
                </button>
              </div>

              {calendarBookings.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">Bronlar topilmadi</div>
              ) : (
                <div className="space-y-2.5">
                  {calendarBookings.slice(0, 5).map((b) => (
                    <div key={b.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{b.customer_name} ({b.customer_phone})</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{b.service_name} • {b.booking_date} {b.start_time}</div>
                      </div>
                      <span className="font-mono font-bold text-indigo-600">{b.booking_number}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Jonli Elektron Navbat</h3>
                <button onClick={() => setActiveTab('queue')} className="text-xs text-indigo-600 hover:underline">
                  Boshqarish
                </button>
              </div>

              {queueEntries.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">Hozircha navbatda hech kim yo‘q</div>
              ) : (
                <div className="space-y-2.5">
                  {queueEntries.slice(0, 5).map((q) => (
                    <div key={q.id} className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg font-black text-amber-900">{q.queue_number}</span>
                        <div>
                          <div className="font-bold text-slate-900">{q.customer_name}</div>
                          <div className="text-[10px] text-slate-500">{q.service_name}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        {q.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CALENDAR & BOOKINGS */}
      {activeTab === 'calendar' && !isExpired && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Bronlar Taqvim Jadvali</h2>
              <p className="text-xs text-slate-500">Mijozlar vaqtlari va statuslarini boshqarish</p>
            </div>
            <button
              onClick={async () => {
                const b = await api.getCalendarBookings();
                setCalendarBookings(b);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 self-start"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Yangilash</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Raqam</th>
                  <th className="py-3 px-4">Mijoz</th>
                  <th className="py-3 px-4">Xizmat</th>
                  <th className="py-3 px-4">Xodim</th>
                  <th className="py-3 px-4">Sana & Vaqt</th>
                  <th className="py-3 px-4">Narxi</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Harakat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calendarBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">{b.booking_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{b.customer_name}</div>
                      <div className="text-[11px] text-slate-500">{b.customer_phone}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{b.service_name}</td>
                    <td className="py-3 px-4 text-slate-600">{b.staff_name}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{b.booking_date}</div>
                      <div className="text-[11px] text-slate-500">{b.start_time} - {b.end_time}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {Number(b.total_price_uzs).toLocaleString('uz-UZ')} UZS
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : b.status === 'COMPLETED'
                            ? 'bg-blue-50 text-blue-700'
                            : b.status === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {b.status === 'CONFIRMED' && (
                        <>
                          <button
                            id={`reminder-btn-${b.id}`}
                            disabled={sendingReminderId === b.id}
                            title="Mijozga eslatma yuborish (Telegram / Bildirishnoma)"
                            onClick={() => handleSendReminder(b.id)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Bell className="w-3 h-3" />
                            <span>{sendingReminderId === b.id ? '...' : 'Eslatma'}</span>
                          </button>
                          <button
                            id={`complete-btn-${b.id}`}
                            onClick={() => handleUpdateStatus(b.id, 'COMPLETED')}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition"
                          >
                            Tugatildi
                          </button>
                          <button
                            id={`noshow-btn-${b.id}`}
                            onClick={() => handleUpdateStatus(b.id, 'NO_SHOW')}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg transition"
                          >
                            Kelmadi
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DIGITAL QUEUE (JONLI ELEKTRON NAVBAT & TELEGRAM TASDIQLASH) */}
      {activeTab === 'queue' && !isExpired && (
        <div className="space-y-6">
          {/* 1. TOP HERO QUEUE CONTROL PANEL */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Elektron Navbat Boshqaruvi</h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Jonli sinxron
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Telegram tasdiqlash orqali bitta tugmada keyingi mijozni xavfsiz va tartibli chaqirish tizimi
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAuditLogs(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  title="Audit Tarixi"
                >
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Audit Tarixi</span>
                </button>
                <button
                  onClick={() => setShowQueueBoardModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
                  title="TV Tablo"
                >
                  <Tv className="w-4 h-4 text-indigo-600" />
                  <span>TV Tablo</span>
                </button>
                <button
                  onClick={refreshQueueData}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                  title="Yangilash"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PENDING TELEGRAM CONFIRMATION BANNER */}
            {pendingAction && (
              <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-indigo-500/10 border-2 border-blue-500/30 ring-4 ring-blue-500/10 transition-all animate-fadeIn">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shrink-0">
                      <Send className="w-6 h-6 animate-bounce" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          Telegram orqali tasdiqlash kutilmoqda...
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-black bg-blue-100 text-blue-700">
                          ⏳ {pendingCountdown}s
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 max-w-xl">
                        Telegram botingizga keyingi mijozni chaqirish xabari yuborildi. Iltimos, Telegram ilovasida{' '}
                        <strong className="text-blue-700 font-bold">«✅ KEYINGI MIJOZNI CHAQIRISH»</strong> tugmasini bosing.
                      </p>
                      {pendingAction.targetCustomer && (
                        <div className="inline-flex items-center gap-2 mt-2 px-2.5 py-1 bg-white/80 border border-blue-200 rounded-lg text-xs font-bold text-slate-800">
                          <span>Chipta:</span>
                          <span className="font-mono text-blue-600">#{pendingAction.targetCustomer.queue_number}</span>
                          <span>•</span>
                          <span>{pendingAction.targetCustomer.customer_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleConfirmFallback}
                      disabled={confirmingFallback}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{confirmingFallback ? 'Tasdiqlanmoqda...' : 'Saytda tasdiqlash'}</span>
                    </button>
                    <button
                      onClick={handleCancelPending}
                      className="px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition"
                    >
                      Bekor qilish
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CURRENT & NEXT CUSTOMER CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* CURRENT CUSTOMER */}
              <div className="p-5 md:p-6 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/30 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      Hozirgi Mijoz (Current)
                    </span>
                    {currentQueueCustomer ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500 text-white shadow-xs">
                        {currentQueueCustomer.status === 'CALLED' ? 'Chaqirilgan' : 'Xizmatda (In Service)'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
                        Bo‘sh
                      </span>
                    )}
                  </div>

                  {currentQueueCustomer ? (
                    <div>
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="font-mono text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                          {currentQueueCustomer.queue_number}
                        </span>
                        <span className="text-base md:text-lg font-bold text-slate-800">
                          {currentQueueCustomer.customer_name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                        <div>🩺 <strong>Xizmat:</strong> {currentQueueCustomer.service_name}</div>
                        <div>📞 <strong>Telefon:</strong> {currentQueueCustomer.customer_phone || 'Mavjud emas'}</div>
                        <div>🕒 <strong>Chaqirilgan:</strong> {currentQueueCustomer.called_at ? new Date(currentQueueCustomer.called_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : 'Hozirgina'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-slate-500">Hozir xizmat ko‘rsatilayotgan mijoz yo‘q</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Keyingi mijozni chaqirish uchun quyidagi tugmani bosing</p>
                    </div>
                  )}
                </div>

                {currentQueueCustomer && (
                  <div className="pt-4 mt-4 border-t border-emerald-200/60 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleAcceptCustomer(currentQueueCustomer.id)}
                      className="flex-1 min-w-[130px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Mijoz keldi (Qabul)</span>
                    </button>
                    <button
                      onClick={() => handleCompleteCurrentCustomer(currentQueueCustomer.id)}
                      className="flex-1 min-w-[130px] py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>Xizmatni yakunlash</span>
                    </button>
                    <button
                      onClick={() => handleNoShowCustomer(currentQueueCustomer.id)}
                      className="px-3 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>O‘tkazib yuborildi (Kelmadi)</span>
                    </button>
                    <button
                      onClick={() => handleCancelCustomer(currentQueueCustomer.id)}
                      className="px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                      title="Bekor qilish"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Bekor qilish</span>
                    </button>
                  </div>
                )}
              </div>

              {/* NEXT WAITING CUSTOMER */}
              <div className="p-5 md:p-6 rounded-2xl border-2 border-amber-500/30 bg-amber-50/30 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                      Navbatdagi Mijoz (Next)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                      {waitingQueueCount} ta kutilmoqda
                    </span>
                  </div>

                  {nextQueueCustomer ? (
                    <div>
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="font-mono text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                          {nextQueueCustomer.queue_number}
                        </span>
                        <span className="text-base md:text-lg font-bold text-slate-800">
                          {nextQueueCustomer.customer_name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                        <div>🩺 <strong>Xizmat:</strong> {nextQueueCustomer.service_name}</div>
                        <div>📞 <strong>Telefon:</strong> {nextQueueCustomer.customer_phone || 'Mavjud emas'}</div>
                        <div>⏳ <strong>Qo‘shilgan vaqti:</strong> {new Date(nextQueueCustomer.joined_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Navbatda kutayotganlar yo‘q</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Barcha mijozlarga xizmat ko‘rsatib bo‘lindi</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-amber-200/60 flex items-center justify-between text-xs text-amber-900 font-medium">
                  <span>Jami kutilayotganlar:</span>
                  <span className="font-bold text-amber-950 font-mono text-sm">{waitingQueueCount} ta mijoz</span>
                </div>
              </div>
            </div>

            {/* ONE-TAP PRIMARY ACTION BUTTON: NEXT CUSTOMER */}
            <div className="pt-3">
              <button
                id="next-customer-primary-btn"
                onClick={handleCallNextCustomer}
                disabled={requestingNext || waitingQueueCount === 0}
                className={`w-full py-5 md:py-6 px-6 rounded-2xl font-black text-lg md:text-2xl text-slate-950 shadow-xl transition-all duration-200 flex items-center justify-center gap-3.5 ${
                  waitingQueueCount === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-500 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.98] ring-4 ring-amber-400/25 cursor-pointer'
                }`}
              >
                <span className="text-xl md:text-2xl">▶</span>
                <span>{requestingNext ? 'Chaqirilmoqda...' : 'KEYINGI MIJOZ'}</span>
                <ArrowRight className={`w-6 h-6 ${requestingNext ? 'animate-spin' : ''}`} />
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3.5 px-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Mijozga avtomatik Telegram xabari va SMS chaqiruvi yuboriladi
                </span>
                <span>
                  {business?.telegram_chat_id ? (
                    <span className="text-emerald-600 font-bold">✓ Telegram bot ulangan</span>
                  ) : (
                    <span className="text-slate-500">Telegram bot bilan sinxron</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* 2. FULL TODAY'S QUEUE TABLE / LIST */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Bugungi Navbat Ro‘yxati</h3>
                <p className="text-xs text-slate-500">Mijozlar holati, chiptalar va xizmat davomiyligi</p>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
                {(['ALL', 'WAITING', 'CALLED_SERVING', 'COMPLETED', 'NO_SHOW'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setQueueStatusFilter(filterKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                      queueStatusFilter === filterKey
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {filterKey === 'ALL' && 'Barchasi'}
                    {filterKey === 'WAITING' && 'Kutilmoqda'}
                    {filterKey === 'CALLED_SERVING' && 'Xizmatda'}
                    {filterKey === 'COMPLETED' && 'Tugallangan'}
                    {filterKey === 'NO_SHOW' && 'Kelmadi'}
                  </button>
                ))}
              </div>
            </div>

            {queueEntries.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Bugun uchun navbatda hech kim yo‘q. Mijozlar QR kod yoki veb-sayt orqali navbat olishlari mumkin.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Chipta</th>
                      <th className="py-3 px-4">Mijoz</th>
                      <th className="py-3 px-4">Telefon</th>
                      <th className="py-3 px-4">Xizmat</th>
                      <th className="py-3 px-4">Qo‘shilgan</th>
                      <th className="py-3 px-4">Holat</th>
                      <th className="py-3 px-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queueEntries
                      .filter(q => {
                        if (queueStatusFilter === 'ALL') return true;
                        if (queueStatusFilter === 'WAITING') return q.status === 'WAITING';
                        if (queueStatusFilter === 'CALLED_SERVING') return ['CALLED', 'IN_SERVICE', 'SERVING'].includes(q.status);
                        if (queueStatusFilter === 'COMPLETED') return q.status === 'COMPLETED';
                        if (queueStatusFilter === 'NO_SHOW') return ['NO_SHOW', 'SKIPPED'].includes(q.status);
                        return true;
                      })
                      .map((q) => (
                        <tr key={q.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">
                            {q.queue_number}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {q.customer_name}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-mono">
                            {q.customer_phone}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {q.service_name}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {new Date(q.joined_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                q.status === 'IN_SERVICE' || q.status === 'SERVING'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : q.status === 'CALLED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : q.status === 'WAITING'
                                  ? 'bg-blue-100 text-blue-800'
                                  : q.status === 'COMPLETED'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {q.status === 'IN_SERVICE' || q.status === 'SERVING' ? 'Xizmatda' :
                               q.status === 'CALLED' ? 'Chaqirilgan' :
                               q.status === 'WAITING' ? 'Kutilmoqda' :
                               q.status === 'COMPLETED' ? 'Yakunlandi' : 'Kelmadi'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {q.status === 'WAITING' && (
                                <button
                                  onClick={() => handleQueueAction(q.id, 'CALL')}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-lg transition"
                                >
                                  Chaqirish
                                </button>
                              )}
                              {q.status === 'CALLED' && (
                                <button
                                  onClick={() => handleQueueAction(q.id, 'SERVE')}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition"
                                >
                                  Boshlash
                                </button>
                              )}
                              {['IN_SERVICE', 'SERVING', 'CALLED'].includes(q.status) && (
                                <button
                                  onClick={() => handleCompleteCurrentCustomer(q.id)}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition"
                                >
                                  Yakunlash
                                </button>
                              )}
                              {['WAITING', 'CALLED'].includes(q.status) && (
                                <button
                                  onClick={() => handleNoShowCustomer(q.id)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition"
                                >
                                  Kelmadi
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. AUDIT LOGS MODAL */}
          {showAuditLogs && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900">Navbat Audit Tarixi (Single Source of Truth)</h3>
                  </div>
                  <button
                    onClick={() => setShowAuditLogs(false)}
                    className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Kim qachon keyingi mijozni chaqirganligi, xizmat yakunlanganligi yoki bekor qilinganligi to‘liq qayd etiladi.
                </p>

                <div className="flex-1 overflow-y-auto">
                  {auditLogs.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Hozircha audit yozuvlari mavjud emas.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Vaqt</th>
                          <th className="py-2.5 px-3">Chipta / Mijoz</th>
                          <th className="py-2.5 px-3">Amal</th>
                          <th className="py-2.5 px-3">Holat</th>
                          <th className="py-2.5 px-3">Manba</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-400 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {log.queue_number ? `#${log.queue_number}` : ''} {log.customer_name || ''}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">
                              {log.action}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              {log.previous_status || 'WAITING'} → <strong className="text-slate-900">{log.new_status}</strong>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  log.source === 'TELEGRAM'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {log.source === 'TELEGRAM' ? '🤖 TELEGRAM' : '💻 WEB'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 text-right">
                  <button
                    onClick={() => setShowAuditLogs(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CRM (MIJOZLAR BAZASI) */}
      {activeTab === 'crm' && !isExpired && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Mijozlar Bazasi (CRM)</h2>
              <p className="text-xs text-slate-500">Mijozlar tarixi, tashriflar soni va umumiy xarajatlar</p>
            </div>

            <form onSubmit={handleSearchCRM} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  id="crm-search-input"
                  placeholder="Ism yoki telefon qidirish..."
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Qidirish
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Mijoz</th>
                  <th className="py-3 px-4">Telefon</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Tashriflar</th>
                  <th className="py-3 px-4">Tugallangan</th>
                  <th className="py-3 px-4">Bekor/Kelmadi</th>
                  <th className="py-3 px-4">Jami Sarflangan</th>
                  <th className="py-3 px-4">Oxirgi Tashrif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {crmCustomers.map((c) => (
                  <tr key={c.customer_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.customer_name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{c.customer_phone}</td>
                    <td className="py-3 px-4 text-slate-500">{c.customer_email || '—'}</td>
                    <td className="py-3 px-4 font-bold text-indigo-700">{c.total_bookings}</td>
                    <td className="py-3 px-4 text-emerald-600 font-semibold">{c.completed_visits}</td>
                    <td className="py-3 px-4 text-rose-500">{c.cancelled_count + c.no_show_count}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {Number(c.total_spent_uzs).toLocaleString('uz-UZ')} UZS
                    </td>
                    <td className="py-3 px-4 text-slate-500">{c.last_visit_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SERVICES */}
      {activeTab === 'services' && !isExpired && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Xizmatlar Ro‘yxati</h2>
              <p className="text-xs text-slate-500">Narxlar va vaqt davomiyligi</p>
            </div>
            <button
              id="add-service-btn"
              onClick={() => setShowAddService(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi Xizmat Qo‘shish</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
                    <button
                      onClick={() => handleDeleteService(s.id)}
                      title="O‘chirish"
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{s.description || 'Tavsif berilmagan'}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{s.duration_minutes} daqiqa</span>
                  <span className="font-bold text-indigo-700 text-sm">
                    {Number(s.price_uzs).toLocaleString('uz-UZ')} UZS
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add Service Modal */}
          {showAddService && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-base font-bold text-slate-900 mb-4">Yangi Xizmat Qo‘shish</h3>
                <form onSubmit={handleCreateService} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Xizmat Nomi</label>
                    <input
                      type="text"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Narxi (UZS)</label>
                    <input
                      type="number"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(Number(e.target.value))}
                      required
                      className="w-full border border-slate-300 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Davomiyligi (Daqiqa)</label>
                    <input
                      type="number"
                      value={newServiceDuration}
                      onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                      required
                      className="w-full border border-slate-300 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Tavsif (ixtiyoriy)</label>
                    <textarea
                      value={newServiceDesc}
                      onChange={(e) => setNewServiceDesc(e.target.value)}
                      rows={2}
                      className="w-full border border-slate-300 rounded-xl p-2.5"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddService(false)}
                      className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold"
                    >
                      Bekor qilish
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                    >
                      Qo‘shish
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: STAFF */}
      {activeTab === 'staff' && !isExpired && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Xodimlar & Mutaxassislar</h2>
              <p className="text-xs text-slate-500">Ish jadvali va biriktirilgan xizmatlar</p>
            </div>
            <button
              id="add-staff-btn"
              onClick={() => setShowAddStaff(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi Xodim Qo‘shish</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((st) => (
              <div key={st.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
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
                  <div className="w-full h-full flex items-center justify-center font-bold text-slate-600">
                    {st.name[0]}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{st.name}</h3>
                  <p className="text-xs text-slate-500">{st.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">{st.phone || 'Telefon kiritilmagan'}</p>
                </div>
              </div>
            ))}
          </div>

          {showAddStaff && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-base font-bold text-slate-900 mb-4">Yangi Xodim Qo‘shish</h3>
                <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Ism Familiya</label>
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Lavozim / Mutaxassislik</label>
                    <input
                      type="text"
                      value={newStaffTitle}
                      onChange={(e) => setNewStaffTitle(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Telefon raqami</label>
                    <input
                      type="tel"
                      value={newStaffPhone}
                      onChange={(e) => setNewStaffPhone(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddStaff(false)}
                      className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold"
                    >
                      Bekor qilish
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                    >
                      Saqlash
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: SUBSCRIPTION & TELEGRAM */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Tarif Rejalari, 1 Oylik Obuna va Telegram Bot</h2>
              <p className="text-xs text-slate-500">
                Biznesingizning obuna muddati, to‘lovlar va Telegram orqali xabarnomalarni sozlash
              </p>
            </div>
            <button
              onClick={() => handleRenewSubscription(business.subscription_plan_code || 'PRO')}
              disabled={renewing}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${renewing ? 'animate-spin' : ''}`} />
              <span>{renewing ? 'Uzaytirilmoqda...' : 'Tarifni 1 Oyga Uzaytirish (+30 kun)'}</span>
            </button>
          </div>

          {/* Success messages */}
          {renewSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{renewSuccess}</span>
            </div>
          )}

          {/* Current Subscription Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-5 rounded-2xl border ${
              isExpired ? 'bg-rose-50/50 border-rose-200' : isExpiringSoon ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'
            } shadow-xs`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Joriy Reja</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isExpired ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {business.subscription_plan_code || 'PRO'}
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">{subData?.plan?.name || business.subscription_plan_code || 'PRO'} Tarif</div>
              <p className="text-xs text-slate-500 mt-1">
                Amal qilish davri: <strong>1 oy (30 kun)</strong>
              </p>
            </div>

            <div className={`p-5 rounded-2xl border ${
              isExpired ? 'bg-rose-50/50 border-rose-200' : isExpiringSoon ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'
            } shadow-xs`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qolgan Muddat</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isExpired ? 'bg-rose-600 text-white' : isExpiringSoon ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {isExpired ? 'Tugagan' : `${daysLeft} kun`}
                </span>
              </div>
              <div className={`text-2xl font-black ${isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-600' : 'text-slate-900'}`}>
                {daysLeft} kun qoldi
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tugash sanasi: <strong>{business.subscription_expires_at ? business.subscription_expires_at.slice(0, 10) : 'Noma’lum'}</strong>
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Telegram Bildirishnomalari</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  telegramChatId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {telegramChatId ? 'Ulangan' : 'Ulanmagan'}
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span>{telegramChatId || 'Chat ID yo‘q'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Yangi bronlar, navbatlar va 3 kun qolganda ogohlantirish keladi
              </p>
            </div>
          </div>

          {/* TELEGRAM BOT SETTINGS SECTION */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#0088cc]" />
                <h3 className="text-sm font-bold text-slate-900">Telegram Bot & Guruh Bildirishnomalari</h3>
              </div>
              <a
                href={`https://t.me/Navbat1Uzb_bot?start=biz_${business?.id || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 fill-white" />
                <span>1 bosishda Botga ulanish</span>
              </a>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Mijozlar yangi navbat olganda, bron qilganda yoki <strong>obunangiz tugashiga 3 kun qolganida</strong> darhol shaxsiy yoki xodimlar guruhingizga Telegram xabarlari keladi.
            </p>

            {telegramSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{telegramSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveTelegram} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Shaxsiy Telegram Chat ID (yoki @username)
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="Masalan: 123456789"
                    className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Xodimlar Guruh ID si (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={telegramGroup}
                    onChange={(e) => setTelegramGroup(e.target.value)}
                    placeholder="Masalan: -1001234567890"
                    className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-[11px] text-slate-500">
                  Guruhga <strong>@Navbat1Uzb_bot</strong> ni qo‘shib, xabarlarni butun jamoangiz bilan kuzatishingiz mumkin.
                </div>
                <button
                  type="submit"
                  disabled={savingTelegram}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs shrink-0 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  <span>{savingTelegram ? 'Saqlanmoqda...' : 'Saqlash va Sinov Xabari Yuborish'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* TELEGRAM PAYMENT HIGHLIGHT SECTION */}
          <div className="bg-gradient-to-br from-[#0088cc]/10 via-indigo-50 to-white rounded-3xl border-2 border-[#0088cc]/30 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0088cc]/10 text-[#0088cc] rounded-full text-xs font-black">
                  <Send className="w-3.5 h-3.5 fill-[#0088cc]" />
                  <span>Tezkor & Xavfsiz To‘lov</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  💳 Telegram orqali to‘lov qilish (@mansur_0511)
                </h3>
                <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                  NavbatBor tarifini sotib olish yoki 30 kunga uzaytirish uchun quyidagi tugmani bosing. Xabar avtomatik tayyorlanadi va administrator to‘lovni tasdiqlagach, tarifingiz faollashtiriladi.
                </p>
                <div className="text-xs font-semibold text-slate-500 pt-1">
                  Amal qilish muddati (Tugash sanasi): <strong className="text-slate-900">{business.subscription_expires_at ? business.subscription_expires_at.slice(0, 10) : '—'}</strong>
                </div>
              </div>

              <div className="shrink-0 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenTelegramPayment(subData?.plan || { code: 'PRO', name: 'PRO', price_uzs: 299000 })}
                  className="w-full sm:w-auto px-8 py-4 bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm sm:text-base font-black rounded-2xl transition shadow-lg shadow-[#0088cc]/25 flex items-center justify-center gap-3 cursor-pointer active:scale-[0.98]"
                >
                  <Send className="w-5 h-5 fill-white" />
                  <span>💳 Telegram orqali to‘lash</span>
                </button>
                <p className="text-[11px] text-center text-slate-500">
                  To‘lov administrator tomonidan qo‘lda tasdiqlanadi
                </p>
              </div>
            </div>
          </div>

          {/* ALL PLANS GRID */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Mavjud Tarif Rejalari (1 oylik muddat)</h3>
                <p className="text-xs text-slate-500">O‘zingizga mos tarifni tanlang va to‘lovni Telegram orqali yuboring</p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Joriy tarif: <strong className="text-indigo-600">{business.subscription_plan_code || 'PRO'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { code: 'FREE', name: 'FREE', price: 0, desc: 'Boshlang‘ich bizneslar uchun', staff: 1, bookings: 30 },
                { code: 'START', name: 'START', price: 149000, desc: 'Kichik salon va xususiy ustalar', staff: 3, bookings: 200 },
                { code: 'PRO', name: 'PRO', price: 299000, desc: 'Klinikalar va to‘liq CRM tizimi', staff: 8, bookings: 1000 },
                { code: 'BUSINESS', name: 'BUSINESS', price: 599000, desc: 'Katta tarmoqlar va filiallar', staff: 25, bookings: 'Cheksiz' },
              ].map((p) => {
                const isCurrent = (business.subscription_plan_code || 'PRO') === p.code;
                return (
                  <div
                    key={p.code}
                    className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition ${
                      isCurrent ? 'border-indigo-600 ring-2 ring-indigo-600 shadow-md' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-extrabold text-slate-900 text-base">{p.name}</h3>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                            {isTrial ? 'Sinovda' : 'Faol Reja'}
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-black text-slate-900 mb-1">
                        {p.price === 0 ? 'Bepul' : `${p.price.toLocaleString('uz-UZ')} UZS`}
                      </div>
                      <p className="text-xs text-slate-500 mb-4">{p.desc}</p>

                      <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                        <div>• Muddat: <strong>1 oy (30 kun)</strong></div>
                        <div>• Xodimlar: <strong>{p.staff} tagacha</strong></div>
                        <div>• Oylik bronlar: <strong>{p.bookings}</strong></div>
                        <div>• Elektron navbat tizimi</div>
                        <div>• Telegram bot ogohlantirishlari</div>
                      </div>
                    </div>

                    {p.price > 0 ? (
                      <button
                        onClick={() => handleOpenTelegramPayment(p)}
                        className="w-full py-2.5 mt-6 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
                      >
                        <Send className="w-3.5 h-3.5 fill-white" />
                        <span>💳 Telegram orqali to‘lash</span>
                      </button>
                    ) : (
                      <button
                        disabled={isCurrent}
                        className="w-full py-2.5 mt-6 rounded-xl text-xs font-bold transition bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        {isCurrent ? 'Hozirgi tarif' : 'Bepul tarif'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* TELEGRAM PAYMENT HISTORY & STATUS SECTION */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Telegram To‘lovlari va Holatlar Tarixi
                </h4>
                <p className="text-xs text-slate-500">
                  Administrator (@mansur_0511) tomonidan qo‘lda tasdiqlanadigan to‘lov so‘rovlari
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const updatedSub = await api.getBusinessSubscription();
                  setSubData(updatedSub);
                  showToast('Ma’lumotlar yangilandi', 'success');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Yangilash</span>
              </button>
            </div>

            {(!subData?.transactions || subData.transactions.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-600">Hozircha to‘lovlar tarixi mavjud emas</p>
                <p className="mt-1 text-slate-400">Tarif sotib olish uchun yuqoridagi “💳 Telegram orqali to‘lash” tugmasini bosing</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Sana</th>
                      <th className="py-2.5 px-4">Tarif</th>
                      <th className="py-2.5 px-4">Summa</th>
                      <th className="py-2.5 px-4">To‘lov Usuli</th>
                      <th className="py-2.5 px-4">Holat</th>
                      <th className="py-2.5 px-4">Qabul qiluvchi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {subData.transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono text-slate-500">{tx.created_at?.slice(0, 16)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{tx.plan_code} (30 kun)</td>
                        <td className="py-3 px-4 font-bold text-emerald-700">{tx.amount_uzs?.toLocaleString('uz-UZ')} so‘m</td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0088cc]">
                            <Send className="w-3 h-3 fill-[#0088cc]" />
                            <span>Telegram</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {tx.status === 'PENDING' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                              ⏳ Kutilmoqda
                            </span>
                          ) : tx.status === 'COMPLETED' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✅ To‘landi
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                              ❌ Bekor qilindi
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">@mansur_0511</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: WORKING HOURS */}
      {activeTab === 'hours' && !isExpired && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Haftalik Ish Jadvali</h2>
              <p className="text-xs text-slate-500">Mijozlar ushbu soatlarga asosan bron va navbat oladi</p>
            </div>
          </div>

          {hoursSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{hoursSuccess}</span>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'].map((dayName, dayIndex) => {
              const current = workingHours.find(h => h.day_of_week === dayIndex) || {
                day_of_week: dayIndex,
                open_time: '09:00',
                close_time: '18:00',
                is_closed: dayIndex === 0 ? 1 : 0
              };

              const updateDay = (field: string, value: any) => {
                setWorkingHours(prev => {
                  const exists = prev.some(h => h.day_of_week === dayIndex);
                  if (exists) {
                    return prev.map(h => h.day_of_week === dayIndex ? { ...h, [field]: value } : h);
                  } else {
                    return [...prev, { ...current, [field]: value }];
                  }
                });
              };

              return (
                <div key={dayIndex} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="w-32 font-bold text-slate-800 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${current.is_closed ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                    <span>{dayName}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={current.is_closed === 1}
                        onChange={(e) => updateDay('is_closed', e.target.checked ? 1 : 0)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-600">Dam olish kuni</span>
                    </label>

                    {current.is_closed === 0 ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={current.open_time || '09:00'}
                          onChange={(e) => updateDay('open_time', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs"
                        />
                        <span className="text-slate-400">—</span>
                        <input
                          type="time"
                          value={current.close_time || '18:00'}
                          onChange={(e) => updateDay('close_time', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs"
                        />
                      </div>
                    ) : (
                      <span className="text-slate-400 italic py-1">Yopiq</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              disabled={savingHours}
              onClick={async () => {
                setSavingHours(true);
                setHoursSuccess('');
                try {
                  await api.updateBusinessWorkingHours(workingHours);
                  setHoursSuccess('Ish jadvali muvaffaqiyatli yangilandi!');
                  showToast('Ish jadvali muvaffaqiyatli saqlandi!', 'success');
                } catch (err: any) {
                  showToast(err.message || 'Xatolik yuz berdi', 'error');
                } finally {
                  setSavingHours(false);
                }
              }}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2"
            >
              {savingHours ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{savingHours ? 'Saqlanmoqda...' : 'Jadvalni Saqlash'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 9: MARKETING & AD ANALYTICS */}
      {activeTab === 'marketing' && !isExpired && (
        <div className="space-y-6 max-w-4xl">
          {/* Ad Status Card */}
          <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-amber-500/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                  <Megaphone className="w-3.5 h-3.5" />
                  Top Tavsiya Reklamasi
                </div>
                <h2 className="text-xl font-black">Katalogda 1-O‘rin & «Tavsiya» belgisi</h2>
                <p className="text-xs text-white/90 mt-1 max-w-xl">
                  Biznesingiz Qarshi shahri qidiruvida eng yuqorida chiqadi, ko‘proq mijozlar va bronlar jalb qilasiz.
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-white/80 block uppercase font-bold">Faol holat</span>
                <span className="text-2xl font-black">
                  {adAnalytics?.is_sponsored ? 'Faol ✅' : 'Faol emas ⭕'}
                </span>
                {adAnalytics?.is_sponsored && adAnalytics?.sponsored_until && (
                  <span className="text-xs text-white/90 block mt-1">
                    Gacha: {adAnalytics.sponsored_until.slice(0, 10)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ad Analytics Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Ko‘rishlar (Impressions)</span>
                <Eye className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {adAnalytics?.impressions || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Qidiruvda ko‘rsatilgan soni</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">O‘tishlar (Clicks)</span>
                <MousePointerClick className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {adAnalytics?.clicks || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Profilga kirgan mijozlar</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">CTR Samaradorlik</span>
                <BarChart3 className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {adAnalytics?.impressions && adAnalytics.impressions > 0
                  ? `${((adAnalytics.clicks / adAnalytics.impressions) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Ko‘rishdan o‘tish foizi</p>
            </div>
          </div>

          {/* Promote Action Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">Rag‘batlantirishni faollashtirish</h3>
            <p className="text-xs text-slate-500 mb-4">Muddatni tanlang va qidiruvda eng yuqoriga chiqing</p>

            {promoSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{promoSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-xs">
              {[
                { days: 7, price: 99000, label: '7 Kun' },
                { days: 15, price: 189000, label: '15 Kun' },
                { days: 30, price: 349000, label: '30 Kun (Eng ommabop)' },
              ].map((tier) => (
                <button
                  key={tier.days}
                  onClick={() => setPromoDays(tier.days)}
                  className={`p-4 rounded-xl border text-left transition ${
                    promoDays === tier.days
                      ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-sm">{tier.label}</div>
                  <div className="text-base font-black text-amber-600 mt-1">
                    {tier.price.toLocaleString('uz-UZ')} UZS
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Top-1 kafolati</div>
                </button>
              ))}
            </div>

            <button
              disabled={promoting}
              onClick={async () => {
                setPromoting(true);
                setPromoSuccess('');
                try {
                  const res = await api.promoteBusiness({ duration_days: promoDays, payment_method: 'CLICK' });
                  setPromoSuccess(res.message || 'Reklama muvaffaqiyatli faollashtirildi!');
                  const updatedAd = await api.getBusinessAdAnalytics();
                  setAdAnalytics(updatedAd);
                  showToast('Reklama muvaffaqiyatli faollashtirildi!', 'success');
                } catch (err: any) {
                  showToast(err.message || 'Reklamani yoqishda xatolik', 'error');
                } finally {
                  setPromoting(false);
                }
              }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-500/20 flex items-center gap-2"
            >
              {promoting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              <span>{promoting ? 'Faollashtirilmoqda...' : `${promoDays} kunga Reklamani Yoqish`}</span>
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && business && (
        <QRCodeModal business={business} onClose={() => setShowQRModal(false)} />
      )}

      {/* TV Queue Board Fullscreen Modal */}
      {showQueueBoardModal && business && (
        <QueueBoardModal
          businessSlug={business.slug}
          businessName={business.name}
          onClose={() => setShowQueueBoardModal(false)}
        />
      )}

      {/* Telegram Payment Modal */}
      {paymentModalOpen && selectedPaymentPlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setPaymentModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs transition cursor-pointer"
            >
              ✕
            </button>

            {paymentStep === 'preview' ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0088cc]/10 text-[#0088cc] flex items-center justify-center shrink-0">
                    <Send className="w-6 h-6 fill-[#0088cc]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Telegram orqali to‘lash</h3>
                    <p className="text-xs text-slate-500">NavbatBor tarifini rasmiylashtirish</p>
                  </div>
                </div>

                {/* Plan Info Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tanlangan Tarif</span>
                    <strong className="text-sm text-slate-900 font-black">{selectedPaymentPlan.name} (30 kun)</strong>
                    <p className="text-slate-500 text-[11px] mt-0.5">{business?.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Narx</span>
                    <strong className="text-sm text-emerald-600 font-black">
                      {(selectedPaymentPlan.price_uzs || 299000).toLocaleString('uz-UZ')} so‘m
                    </strong>
                  </div>
                </div>

                {/* Prepared Message Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Telegramga yuboriladigan xabar:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(preparedTelegramMessage);
                          setCopiedMessage(true);
                          setTimeout(() => setCopiedMessage(false), 2500);
                        }
                      }}
                      className="text-[11px] text-[#0088cc] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedMessage ? 'Nusxa olindi! ✅' : 'Nusxa olish'}</span>
                    </button>
                  </div>
                  <div className="p-3.5 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-line shadow-inner border border-slate-800">
                    {preparedTelegramMessage}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    To‘lov avtomatik faollashmaydi. Quyidagi tugmani bosganingizda <strong>@mansur_0511</strong> ochiladi. Administrator to‘lovni tekshirib tasdiqlagach, tarifingiz 30 kunga faollashtiriladi.
                  </p>
                </div>

                {/* Large CTA Button */}
                <button
                  type="button"
                  disabled={telegramPaymentLoading}
                  onClick={handleExecuteTelegramPayment}
                  className="w-full py-4 bg-[#0088cc] hover:bg-[#0077b5] text-white font-black text-sm rounded-2xl shadow-lg shadow-[#0088cc]/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <Send className={`w-5 h-5 fill-white ${telegramPaymentLoading ? 'animate-bounce' : ''}`} />
                  <span>{telegramPaymentLoading ? 'Telegram ochilmoqda...' : '💳 Telegram orqali to‘lash'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-5 text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">So‘rov Telegram orqali yuborildi!</h3>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-black">
                    <span>Holat: Kutilmoqda ⏳</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 leading-relaxed max-w-sm mx-auto">
                    To‘lov administrator (@mansur_0511) tomonidan qo‘lda tasdiqlangach, tarifingiz faollashadi va bildirishnoma keladi.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <a
                    href={`https://t.me/mansur_0511?text=${encodeURIComponent(preparedTelegramMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4 fill-white" />
                    <span>Telegram suhbatini qayta ochish</span>
                  </a>
                  <button
                    onClick={() => setPaymentModalOpen(false)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Tushunarli, yopish
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modern In-App Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50/95 text-emerald-800 border-emerald-300' : 'bg-rose-50/95 text-rose-800 border-rose-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
