import React, { useState, useEffect } from 'react';
import {
  Shield, Building2, Users, FileText, CheckCircle, CheckCircle2, AlertCircle, AlertTriangle,
  RefreshCw, Calendar, Send, CreditCard, Clock, Activity, Search, Filter,
  MessageSquare, Database, ArrowUpRight, Check, TrendingUp,
  Star, Trash2, Eye, X, Megaphone, Key, UserPlus, Lock,
  Download, BarChart3, ShieldAlert, Award, MapPin, Phone
} from 'lucide-react';
import { api } from '../api';
import { useTranslation } from '../i18n/LanguageContext';
import { useToast } from '../hooks/useTimedState';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useConfirm, usePrompt } from './ui/Dialog';
import { asArray, asNumber, asObject } from '../utils/safe';

/** Uzbek weekday names for `day_of_week` 0 (Sunday) .. 6 (Saturday), as returned by the business-applications API. */
const WEEKDAY_NAMES_UZ = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

/**
 * Normalises `/api/admin/reports` so every nested section the UI reads exists.
 * Missing numbers default to 0 and missing lists to [].
 */
function normalizeReports(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  const financial = asObject(raw.financial);
  const businesses = asObject(raw.businesses);
  const users = asObject(raw.users);
  const num = (obj: Record<string, any>, key: string) => asNumber(obj[key]);
  return {
    ...raw,
    financial: {
      ...financial,
      totalGrossRevenue: num(financial, 'totalGrossRevenue'),
      monthlyGrossRevenue: num(financial, 'monthlyGrossRevenue'),
      todayGrossRevenue: num(financial, 'todayGrossRevenue'),
      avgBookingValue: num(financial, 'avgBookingValue'),
      totalBookingsCount: num(financial, 'totalBookingsCount'),
      completedCount: num(financial, 'completedCount'),
      confirmedCount: num(financial, 'confirmedCount'),
      pendingBookingsCount: num(financial, 'pendingBookingsCount'),
      cancelledCount: num(financial, 'cancelledCount'),
    },
    businesses: {
      ...businesses,
      total: num(businesses, 'total'),
      approved: num(businesses, 'approved'),
      pending: num(businesses, 'pending'),
      suspended: num(businesses, 'suspended'),
      rejected: num(businesses, 'rejected'),
      verified: num(businesses, 'verified'),
      topPerformers: asArray(businesses.topPerformers),
    },
    users: {
      ...users,
      total: num(users, 'total'),
      active: num(users, 'active'),
      blocked: num(users, 'blocked'),
      roles: asArray(users.roles),
    },
    topServices: asArray(raw.topServices),
    queueStats: asObject(raw.queueStats),
  };
}

/** Normalises `/api/admin/system-health` (tableCounts may be missing on older backends). */
function normalizeSystemHealth(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    uptimeSeconds: asNumber(raw.uptimeSeconds),
    memoryUsageMB: raw.memoryUsageMB ?? '—',
    tableCounts: asObject(raw.tableCounts),
  };
}

function normalizeSubscriptions(raw: any): { subscriptions: any[]; transactions: any[]; pendingTransactions?: any[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    subscriptions: asArray(raw.subscriptions),
    transactions: asArray(raw.transactions),
    ...(raw.pendingTransactions !== undefined ? { pendingTransactions: asArray(raw.pendingTransactions) } : {}),
  };
}

interface BusinessApplicationCardProps {
  app: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  actionLoading: boolean;
  onApprove: () => void;
  onReject: () => void;
}

/** One pending Telegram-bot-submitted business application, with its photos & weekly schedule. */
const BusinessApplicationCard: React.FC<BusinessApplicationCardProps> = ({
  app,
  isExpanded,
  onToggleExpand,
  actionLoading,
  onApprove,
  onReject,
}) => {
  const photos = asArray(app.photos);
  const hours = asArray(app.hours)
    .slice()
    .sort((a: any, b: any) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0));
  const submittedAt = app.created_at
    ? new Date(app.created_at).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
  const telegramHandle = (app.telegram_username || '').replace(/^@/, '');

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black text-slate-900">{app.name || 'Nomsiz ariza'}</h4>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full uppercase">
                Kutilmoqda
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {[app.category_name, app.city_name, app.district].filter(Boolean).join(' • ')}
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            {submittedAt && <p className="text-[11px] text-slate-400">{submittedAt}</p>}
            {telegramHandle && (
              <p className="text-[11px] text-sky-600 font-semibold mt-0.5 flex items-center gap-1 sm:justify-end">
                <Send className="w-3 h-3" />
                <span>@{telegramHandle}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {app.phone && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-mono">{app.phone}</span>
            </div>
          )}
          {app.address && (
            <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{app.address}</span>
            </div>
          )}
        </div>

        {app.description && (
          <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100 leading-relaxed whitespace-pre-wrap">
            {app.description}
          </p>
        )}

        {photos.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {photos.map((p: any) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img
                  src={p.url}
                  alt={app.name || 'Ariza rasmi'}
                  loading="lazy"
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200 hover:opacity-80 transition"
                />
              </a>
            ))}
          </div>
        )}

        {hours.length > 0 && (
          <>
            <button
              type="button"
              onClick={onToggleExpand}
              className="mt-3 text-[11px] font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer inline-flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isExpanded ? 'Ish vaqtini yashirish' : 'Ish vaqtini ko‘rsatish'}</span>
            </button>

            {isExpanded && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                {hours.map((h: any) => (
                  <div key={h.day_of_week} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="font-semibold text-slate-600 shrink-0">{WEEKDAY_NAMES_UZ[h.day_of_week] ?? '—'}</span>
                    <span className={`font-mono text-right ${h.is_closed ? 'text-rose-500 font-semibold' : 'text-slate-700'}`}>
                      {h.is_closed
                        ? 'Dam olish kuni'
                        : `${h.open_time || '—'}–${h.close_time || '—'}${h.break_start ? ` (tanaffus ${h.break_start}–${h.break_end})` : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100">
        <button
          type="button"
          onClick={onApprove}
          disabled={actionLoading}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          {actionLoading ? 'Bajarilmoqda...' : '✅ Tasdiqlash'}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={actionLoading}
          className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          ❌ Rad etish
        </button>
      </div>
    </div>
  );
};

interface AdminPanelProps {
  onSwitchToPartner?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onSwitchToPartner }) => {
  const { lang } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'businesses' | 'bookings' | 'reviews' | 'promotions' | 'subscriptions' | 'telegram' | 'users' | 'audit'>('overview');
  
  // Data states
  const [overview, setOverview] = useState<any | null>(null);
  const [reportsData, setReportsData] = useState<any | null>(null);
  const [chartsData, setChartsData] = useState<any | null>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState<number>(0);
  const [bookingsPage, setBookingsPage] = useState<number>(1);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [bookingSearch, setBookingSearch] = useState<string>('');
  
  const [subscriptionsData, setSubscriptionsData] = useState<{ subscriptions: any[]; transactions: any[] } | null>(null);
  const [telegramLogs, setTelegramLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bizSearch, setBizSearch] = useState<string>('');
  const [bizStatusFilter, setBizStatusFilter] = useState<string>('ALL');

  // User Filter States
  const [userSearch, setUserSearch] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  const [blockModalTarget, setBlockModalTarget] = useState<any | null>(null);
  const [blockReason, setBlockReason] = useState<string>('');
  const [blockLoading, setBlockLoading] = useState<boolean>(false);

  // Business Inspection & Rejection Modals
  const [inspectBusiness, setInspectBusiness] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Telegram test modal state
  const [testChatId, setTestChatId] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('Assalomu alaykum! Bu NavbatBor platformasining sinov bildirishnomasi.');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Admin User Provisioning & Password Management
  const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState<string>('+998');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<string>('BUSINESS_OWNER');
  const [userModalLoading, setUserModalLoading] = useState<boolean>(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);

  const [resetPasswordTarget, setResetPasswordTarget] = useState<any | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState<string>('');
  const [resetModalLoading, setResetModalLoading] = useState<boolean>(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);
  const [credentialsBanner, setCredentialsBanner] = useState<string | null>(null);

  // Telegram bot business applications (review queue)
  const [bizApplications, setBizApplications] = useState<any[]>([]);
  const [bizAppsLoading, setBizAppsLoading] = useState<boolean>(true);
  const [bizAppsError, setBizAppsError] = useState<string | null>(null);
  const [bizAppActionLoading, setBizAppActionLoading] = useState<string | null>(null);
  const [expandedBizAppId, setExpandedBizAppId] = useState<string | null>(null);

  const { toast, showToast } = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();

  // Escape closes the top-most admin modal.
  useEscapeKey(() => { setRejectModal(null); setRejectReason(''); }, !!rejectModal);
  useEscapeKey(() => setInspectBusiness(null), !!inspectBusiness);
  useEscapeKey(() => setShowCreateUserModal(false), showCreateUserModal);
  useEscapeKey(() => setResetPasswordTarget(null), !!resetPasswordTarget);
  useEscapeKey(() => setBlockModalTarget(null), !!blockModalTarget);

  // Load Admin Data — every section independently, so one failing endpoint does not blank the panel.
  const loadData = async () => {
    setLoading(true);
    try {
      const sections: Array<{ label: string; run: () => Promise<any>; apply: (value: any) => void }> = [
        { label: 'Umumiy ko‘rsatkichlar', run: api.getAdminOverview, apply: (v) => setOverview(v && typeof v === 'object' ? v : null) },
        { label: 'Hisobotlar', run: api.getAdminReports, apply: (v) => setReportsData(normalizeReports(v)) },
        { label: 'Grafiklar', run: api.getAdminCharts, apply: (v) => setChartsData(v && typeof v === 'object' ? v : null) },
        { label: 'Bizneslar', run: api.getAdminBusinesses, apply: (v) => setBusinesses(asArray(v)) },
        { label: 'Obunalar', run: api.getAdminSubscriptions, apply: (v) => setSubscriptionsData(normalizeSubscriptions(v)) },
        { label: 'Telegram loglari', run: api.getAdminTelegramLogs, apply: (v) => setTelegramLogs(asArray(v)) },
        { label: 'Foydalanuvchilar', run: api.getAdminUsers, apply: (v) => setUsers(asArray(v)) },
        { label: 'Audit', run: api.getAdminAuditLogs, apply: (v) => setAuditLogs(asArray(v)) },
        { label: 'Tizim holati', run: api.getAdminSystemHealth, apply: (v) => setSystemHealth(normalizeSystemHealth(v)) },
        { label: 'Sharhlar', run: api.getAdminReviews, apply: (v) => setReviews(asArray(v)) },
        { label: 'Reklamalar', run: api.getAdminPromotions, apply: (v) => setPromotions(asArray(v)) },
      ];
      const results = await Promise.allSettled(sections.map((section) => section.run()));
      const failed: string[] = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          sections[i].apply(result.value);
        } else {
          failed.push(sections[i].label);
          console.error(`Admin panel: "${sections[i].label}" yuklanmadi`, result.reason);
        }
      });
      if (failed.length > 0) {
        showToast(`Ba’zi bo‘limlar yuklanmadi: ${failed.join(', ')}`, 'error');
      }

      // Load bookings
      loadBookings(1, bookingStatusFilter, bookingSearch);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async (page: number, status: string, q: string) => {
    try {
      const res = await api.getAdminAllBookings({
        page,
        limit: 20,
        status: status === 'ALL' ? undefined : status,
        q: q ? q : undefined,
      });
      setAllBookings(asArray(res?.bookings));
      setBookingsTotal(asNumber(res?.total));
      setBookingsPage(asNumber(res?.page, page) || page);
    } catch (err: any) {
      console.error('Error loading bookings:', err);
      showToast(err?.message || 'Bronlarni yuklashda xatolik', 'error');
    }
  };

  // Telegram bot business applications load independently — a failure here must not blank the rest of the panel.
  const loadBusinessApplications = async () => {
    setBizAppsLoading(true);
    setBizAppsError(null);
    try {
      const apps = await api.getBusinessApplications('PENDING');
      setBizApplications(asArray(apps));
    } catch (err: any) {
      setBizAppsError(err?.message || 'Arizalarni yuklashda xatolik yuz berdi');
    } finally {
      setBizAppsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadBusinessApplications();
  }, []);

  const handleApproveBizApplication = async (app: any) => {
    setBizAppActionLoading(app.id);
    try {
      await api.approveBusinessApplication(app.id);
      showToast(`"${app.name}" arizasi tasdiqlandi va biznes yaratildi`, 'success');
      await loadBusinessApplications();
      const [bList, ov] = await Promise.all([
        api.getAdminBusinesses().catch(() => null),
        api.getAdminOverview().catch(() => null),
      ]);
      if (bList) setBusinesses(asArray(bList));
      if (ov) setOverview(ov);
    } catch (err: any) {
      showToast(err?.message || 'Arizani tasdiqlashda xatolik', 'error');
    } finally {
      setBizAppActionLoading(null);
    }
  };

  const handleRejectBizApplication = async (app: any) => {
    const reason = await prompt({
      title: 'Arizani rad etish',
      message: `"${app.name}" arizasini rad etish sababini kiriting:`,
      placeholder: 'Masalan: rasm sifatsiz, manzil noto‘g‘ri...',
      multiline: true,
      required: true,
      confirmText: 'Rad etish',
      tone: 'danger',
    });
    if (!reason?.trim()) return;
    setBizAppActionLoading(app.id);
    try {
      await api.rejectBusinessApplication(app.id, reason.trim());
      showToast(`"${app.name}" arizasi rad etildi`, 'success');
      await loadBusinessApplications();
    } catch (err: any) {
      showToast(err?.message || 'Arizani rad etishda xatolik', 'error');
    } finally {
      setBizAppActionLoading(null);
    }
  };

  const handleUpdateBusiness = async (id: string, data: { status?: string; is_verified?: boolean; reason?: string }) => {
    setActionLoading(id);
    try {
      await api.updateAdminBusinessStatus(id, data);
      const bList = await api.getAdminBusinesses();
      setBusinesses(asArray(bList));
      const ov = await api.getAdminOverview();
      setOverview(ov);
      showToast('Biznes holati muvaffaqiyatli yangilandi!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik yuz berdi', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInspectBusiness = async (b: any) => {
    setInspectLoading(true);
    try {
      const details = await api.getBusinessBySlug(b.slug);
      let queueList: any[] = [];
      try {
        queueList = await api.getBusinessQueue(b.id);
      } catch (e) {}
      setInspectBusiness({
        ...b,
        ...details.business,
        services: details.services || [],
        staff: details.staff || [],
        hours: details.hours || [],
        reviews: details.reviews || [],
        queueEntries: queueList || [],
      });
    } catch (err: any) {
      showToast('Biznes tafsilotlarini yuklashda xatolik: ' + (err.message || ''), 'error');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModal) return;
    await handleUpdateBusiness(rejectModal.id, {
      status: 'REJECTED',
      reason: rejectReason.trim() || 'Muassasa ma’lumotlari tekshiruvdan o‘tmadi.',
    });
    setRejectModal(null);
    setRejectReason('');
  };

  const handleDeleteReview = async (id: string) => {
    const ok = await confirm({
      title: 'Sharhni o‘chirish',
      message: 'Haqiqatan ham ushbu soxta/nojo‘ya sharhni o‘chirmoqchimisiz?',
      confirmText: 'O‘chirish',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteAdminReview(id);
      const rList = await api.getAdminReviews();
      setReviews(asArray(rList));
      const ov = await api.getAdminOverview();
      setOverview(ov);
      showToast('Sharh muvaffaqiyatli o‘chirildi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleExtendSubscription = async (bizId: string, months: number = 1) => {
    setActionLoading(`sub-${bizId}`);
    try {
      await api.extendAdminSubscription(bizId, { months });
      const subs = await api.getAdminSubscriptions();
      setSubscriptionsData(normalizeSubscriptions(subs));
      const bList = await api.getAdminBusinesses();
      setBusinesses(asArray(bList));
      const ov = await api.getAdminOverview();
      setOverview(ov);
      showToast(`Tarif muvaffaqiyatli ${months} oyga (+${months * 30} kun) uzaytirildi!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmPayment = async (txId: string) => {
    setActionLoading(`pay-${txId}`);
    try {
      await api.confirmAdminPayment(txId);
      const subs = await api.getAdminSubscriptions();
      setSubscriptionsData(normalizeSubscriptions(subs));
      const bList = await api.getAdminBusinesses();
      setBusinesses(asArray(bList));
      const ov = await api.getAdminOverview();
      setOverview(ov);
      showToast('To‘lov tasdiqlandi va tarif muvaffaqiyatli faollashtirildi!', 'success');
    } catch (err: any) {
      showToast(err.message || 'To‘lovni tasdiqlashda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelPayment = async (txId: string) => {
    setActionLoading(`pay-cancel-${txId}`);
    try {
      await api.cancelAdminPayment(txId);
      const subs = await api.getAdminSubscriptions();
      setSubscriptionsData(normalizeSubscriptions(subs));
      showToast('To‘lov so‘rovi bekor qilindi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateBookingStatus = async (id: string, newStatus: string) => {
    try {
      await api.updateAdminBookingStatus(id, newStatus);
      loadBookings(bookingsPage, bookingStatusFilter, bookingSearch);
      showToast('Buyurtma holati yangilandi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleUpdateUser = async (id: string, data: { status?: string; role?: string }) => {
    try {
      await api.updateAdminUserStatus(id, data);
      const uList = await api.getAdminUsers();
      setUsers(asArray(uList));
      showToast('Foydalanuvchi ma’lumotlari yangilandi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik', 'error');
    }
  };

  const handleToggleUserBlock = async (userOrId: any, newStatus: 'ACTIVE' | 'BLOCKED', reason?: string) => {
    const userId = typeof userOrId === 'object' && userOrId !== null ? userOrId.id : userOrId;
    if (!userId) return;
    setActionLoading(`user-${userId}`);
    setBlockLoading(true);
    try {
      await api.updateAdminUserStatus(userId, { status: newStatus, reason });
      const uList = await api.getAdminUsers();
      setUsers(asArray(uList));
      const ov = await api.getAdminOverview();
      setOverview(ov);
      const rep = await api.getAdminReports().catch(() => null);
      if (rep) setReportsData(normalizeReports(rep));
      const aList = await api.getAdminAuditLogs();
      setAuditLogs(asArray(aList));
      setBlockModalTarget(null);
      setBlockReason('');
      showToast('Foydalanuvchi holati o‘zgartirildi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Xatolik yuz berdi', 'error');
    } finally {
      setActionLoading(null);
      setBlockLoading(false);
    }
  };

  const handleExportReportsCSV = () => {
    if (!reportsData) {
      showToast('Hisobot ma’lumotlari hali yuklanmadi', 'error');
      return;
    }
    const { financial, businesses: bizStats, users: userStats } = reportsData;
    const rows = [
      ['NAVBATBOR PLATFORMASI - TIZIM RASMIY HISOBOTI'],
      [`Hisobot yaratilgan vaqt: ${new Date().toLocaleString('uz-UZ')}`],
      [''],
      ['1. MOLIYAVIY KO‘RSATKICHLAR'],
      ['Jami Moliya Aylanmasi (so‘m)', financial.totalGrossRevenue],
      ['Joriy Oylik Tushum (so‘m)', financial.monthlyGrossRevenue],
      ['Bugungi Tushum (so‘m)', financial.todayGrossRevenue],
      ['O‘rtacha Bron Qiymati (so‘m)', financial.avgBookingValue],
      ['Jami Bronlar Soni', financial.totalBookingsCount],
      ['Yakunlangan Bronlar Soni', financial.completedCount],
      ['Tasdiqlangan Bronlar Soni', financial.confirmedCount],
      ['Kutilayotgan Bronlar Soni', financial.pendingBookingsCount],
      ['Bekor Qilingan Bronlar', financial.cancelledCount],
      [''],
      ['2. MUASSASALAR VA ARIZALAR STATISTIKASI'],
      ['Jami Bizneslar', bizStats.total],
      ['Faol / Tasdiqlangan Bizneslar', bizStats.approved],
      ['Tasdiq Kutayotgan Arizalar', bizStats.pending],
      ['Faoliyati To‘xtatilgan', bizStats.suspended],
      ['Rad Etilgan Arizalar', bizStats.rejected],
      ['Rasmiy Tasdiqlangan (Verified)', bizStats.verified],
      [''],
      ['3. TOP BIZNESLAR REYTINGI'],
      ['Reyting', 'Biznes Nomi', 'Kategoriya', 'Shahar', 'Egasi', 'Telefon', 'Jami Bronlar', 'Yakunlangan', 'Aylanma (so‘m)', 'Baho'],
      ...(bizStats.topPerformers || []).map((b: any, idx: number) => [
        idx + 1,
        `"${b.name}"`,
        b.category_name,
        b.city_name,
        b.owner_name,
        b.owner_phone || '',
        b.total_bookings,
        b.completed_bookings,
        b.total_revenue,
        b.rating
      ]),
      [''],
      ['4. FOYDALANUVCHILAR VA XAVFSIZLIK'],
      ['Jami Foydalanuvchilar', userStats.total],
      ['Faol Foydalanuvchilar', userStats.active],
      ['Bloklangan Foydalanuvchilar', userStats.blocked],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `navbatbor-tizim-hisoboti-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);
    setUserModalLoading(true);
    try {
      await api.createAdminUser({
        name: newUserName,
        email: newUserEmail,
        phone: newUserPhone,
        password: newUserPassword,
        role: newUserRole,
      });
      setShowCreateUserModal(false);
      setCredentialsBanner(`Yangi akkaunt yaratildi! Email: ${newUserEmail}, Parol: ${newUserPassword}, Rol: ${newUserRole}. Ushbu login va parolni biznes egasiga topshirishingiz mumkin.`);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPhone('+998');
      setNewUserPassword('');
      const uList = await api.getAdminUsers();
      setUsers(asArray(uList));
    } catch (err: any) {
      setUserModalError(err.message || 'Xatolik yuz berdi');
    } finally {
      setUserModalLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTarget) return;
    setResetModalError(null);
    setResetModalLoading(true);
    try {
      await api.resetAdminUserPassword(resetPasswordTarget.id, resetPasswordValue);
      setCredentialsBanner(`${resetPasswordTarget.name} (${resetPasswordTarget.email}) uchun yangi parol o‘rnatildi: "${resetPasswordValue}". Foydalanuvchi endi ushbu parol orqali tizimga kiradi.`);
      setResetPasswordTarget(null);
      setResetPasswordValue('');
    } catch (err: any) {
      setResetModalError(err.message || 'Xatolik yuz berdi');
    } finally {
      setResetModalLoading(false);
    }
  };

  const handleSendTelegramTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testChatId) return;
    setTestStatus('Yuborilmoqda...');
    try {
      const res = await api.sendAdminTelegram({
        chat_id: testChatId,
        message: testMessage,
      });
      if (res.success) {
        setTestStatus(`Muvaffaqiyatli yuborildi! (${res.status})`);
      } else {
        setTestStatus(`Xatolik: ${res.error || 'Yuborilmadi'}`);
      }
      const tgLogs = await api.getAdminTelegramLogs();
      setTelegramLogs(asArray(tgLogs));
    } catch (err: any) {
      setTestStatus(`Xatolik: ${err.message}`);
    }
  };

  // Pending count shown on the "Bizneslar & Arizalar" tab badge folds in both legacy PENDING
  // businesses and newly submitted Telegram bot applications (single combined badge, per product decision).
  const combinedPendingCount = (overview?.pendingBizCount || 0) + bizApplications.length;

  // Filter businesses
  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch = (b.name || '').toLowerCase().includes(bizSearch.toLowerCase()) || 
                          b.city_name?.toLowerCase().includes(bizSearch.toLowerCase()) ||
                          b.owner_name?.toLowerCase().includes(bizSearch.toLowerCase());
    const matchesStatus = bizStatusFilter === 'ALL' || b.status === bizStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter users
  const filteredUsers = users.filter((u) => {
    const query = userSearch.toLowerCase();
    const matchesSearch = 
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.phone && u.phone.toLowerCase().includes(query));
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-16">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 mb-8 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">NavbatBor Boshqaruv Markazi</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Ekotizim metrikalari, biznes arizalarini tasdiqlash, foydalanuvchilar xavfsizligi va real hisobotlar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {systemHealth && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Uptime: {Math.floor(systemHealth.uptimeSeconds / 60)} daq</span>
                <span className="text-slate-600">|</span>
                <span>RAM: {systemHealth.memoryUsageMB} MB</span>
              </div>
            )}
            <button
              onClick={loadData}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Yangilash</span>
            </button>
          </div>
        </div>

        {/* Global Key Metrics Ribbon */}
        {overview && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Jami Bizneslar</div>
              <div className="text-lg font-black text-white mt-0.5">
                {overview.bizCount} <span className="text-[10px] font-normal text-slate-400">({overview.activeBizCount || 0} faol)</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-amber-400 font-medium">Kutayotgan Arizalar</div>
              <div className="text-lg font-black text-amber-300 mt-0.5 flex items-center gap-1.5">
                <span>{combinedPendingCount}</span>
                {combinedPendingCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Foydalanuvchilar</div>
              <div className="text-lg font-black text-white mt-0.5">{overview.usersCount}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Yakunlangan Bronlar</div>
              <div className="text-lg font-black text-emerald-400 mt-0.5">
                {overview.completedBookingsCount ?? 0} <span className="text-[10px] font-normal text-slate-400">/ {overview.bookingsCount}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-sky-400 font-medium">Jonli Navbatlar</div>
              <div className="text-lg font-black text-sky-300 mt-0.5">
                {overview.activeQueuesCount ?? 0} <span className="text-[10px] font-normal text-slate-400">mijoz</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-400 font-medium">Jami Aylanma</div>
              <div className="text-lg font-black text-emerald-400 mt-0.5">
                {overview.revenueTotal?.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">so‘m</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Operating Partner quick access banner for Founder */}
      <div className="mb-6 p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Qarshi Operating Partner Tizimi</span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">Faol (30% / 70%)</span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Mahalliy hamkor boshqaruvi, CRM voronka, 30% hamkor komissiyasi, haftalik hisobotlar va KPI ko‘rsatkichlari.
            </p>
          </div>
        </div>
        {onSwitchToPartner && (
          <button
            onClick={onSwitchToPartner}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <span>Hamkor Dashboardiga o‘tish</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-8 overflow-x-auto text-xs no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {[
          { 
            id: 'overview', 
            label: lang === 'ru' ? 'Панель управления' : lang === 'en' ? 'Overview & Charts' : 'Boshqaruv Paneli', 
            icon: TrendingUp 
          },
          { 
            id: 'reports', 
            label: lang === 'ru' ? 'Отчёты и аналитика' : lang === 'en' ? 'Reports & Analytics' : 'Tizim Hisobotlari & Analitika', 
            icon: BarChart3 
          },
          { 
            id: 'businesses', 
            label: `${lang === 'ru' ? 'Бизнесы и заявки' : lang === 'en' ? 'Businesses & Requests' : 'Bizneslar & Arizalar'} (${businesses.length})`,
            icon: Building2,
            badge: combinedPendingCount > 0
          },
          { 
            id: 'users', 
            label: `${lang === 'ru' ? 'Пользователи и доступ' : lang === 'en' ? 'Users & Security' : 'Foydalanuvchilar & Xavfsizlik'} (${users.length})`, 
            icon: Users 
          },
          { 
            id: 'bookings', 
            label: `${lang === 'ru' ? 'Все бронирования' : lang === 'en' ? 'All Bookings' : 'Barcha Bronlar'} (${bookingsTotal})`, 
            icon: Calendar 
          },
          { 
            id: 'reviews', 
            label: `${lang === 'ru' ? 'Модерация отзывов' : lang === 'en' ? 'Reviews' : 'Sharhlar Moderatsiyasi'} (${reviews.length})`, 
            icon: Star 
          },
          { 
            id: 'promotions', 
            label: `${lang === 'ru' ? 'Реклама и промо' : lang === 'en' ? 'Ads & Top Spots' : 'Reklama & Top Joylar'} (${promotions.length})`, 
            icon: Megaphone 
          },
          { 
            id: 'subscriptions', 
            label: `${lang === 'ru' ? 'Тарифы и подписки' : lang === 'en' ? 'Plans & Subscriptions' : 'Tariflar & Obunalar'} (${(overview?.expiringSoonCount || 0) + (overview?.expiredCount || 0)})`, 
            icon: CreditCard,
            badge: (overview?.expiringSoonCount || 0) + (overview?.expiredCount || 0) > 0
          },
          { 
            id: 'telegram', 
            label: `${lang === 'ru' ? 'Центр Telegram Бота' : lang === 'en' ? 'Telegram Bot Hub' : 'Telegram Bot Markazi'} (${telegramLogs.length})`, 
            icon: MessageSquare 
          },
          { 
            id: 'audit', 
            label: lang === 'ru' ? 'Аудит и безопасность' : lang === 'en' ? 'Audit & Security Logs' : 'Audit & Xavfsizlik', 
            icon: FileText 
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 1. OVERVIEW & CHARTS TAB */}
      {/* ======================================================== */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-8">
          {/* Status alerts for expiring tariffs */}
          {((overview.expiringSoonCount || 0) > 0 || (overview.expiredCount || 0) > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="text-xs text-amber-900">
                  <span className="font-bold">Diqqat: 1 oylik tarif muddati tugayotgan bizneslar mavjud! </span>
                  {overview.expiringSoonCount} ta biznesning tarifi 3 kun ichida tugaydi, {overview.expiredCount} tasiniki tugagan.
                </div>
              </div>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer"
              >
                Ko‘rish va ogohlantirish
              </button>
            </div>
          )}

          {/* Pending Business Applications Quick Approval Widget */}
          {overview.pendingBizCount > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 rounded-3xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    {overview.pendingBizCount}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Tasdiq Kutayotgan Biznes Arizalari</h3>
                    <p className="text-xs text-slate-500">Ushbu muassasalar siz tasdiqlamaguningizcha mijozlar uchun ochilmaydi</p>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveTab('businesses'); setBizStatusFilter('PENDING'); }}
                  className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-xl transition cursor-pointer self-start sm:self-auto"
                >
                  Barcha arizalarni ko‘rish ({overview.pendingBizCount}) →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {businesses.filter(b => b.status === 'PENDING').slice(0, 3).map((b) => (
                  <div key={b.id} className="bg-white rounded-2xl p-4 border border-amber-200/90 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-black text-slate-900 text-sm leading-snug">{b.name}</div>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">Kutilmoqda</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{b.city_name} • {b.category_name}</p>
                      <div className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div><strong className="text-slate-700">Mas’ul:</strong> {b.owner_name}</div>
                        <div><strong className="text-slate-700">Telefon:</strong> <span className="font-mono">{b.phone}</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => handleUpdateBusiness(b.id, { status: 'APPROVED' })}
                        disabled={actionLoading === b.id}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition text-center cursor-pointer shadow-xs"
                      >
                        {actionLoading === b.id ? 'Tasdiqlanmoqda...' : 'Tasdiqlash'}
                      </button>
                      <button
                        onClick={() => setRejectModal({ id: b.id, name: b.name })}
                        disabled={actionLoading === b.id}
                        className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Rad etish
                      </button>
                      <button
                        onClick={() => handleInspectBusiness(b)}
                        className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                        title="To‘liq ma’lumotlarni ko‘rish"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jami Aylanma</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {overview.revenueTotal?.toLocaleString()} <span className="text-xs font-normal text-slate-400">so‘m</span>
              </div>
              <span className="text-xs text-emerald-600 font-semibold mt-2 block">
                Oylik tushum: {overview.monthlyRevenue?.toLocaleString()} so‘m
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Faol Bizneslar</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {overview.activeBizCount} <span className="text-xs font-normal text-slate-400">/ {overview.bizCount}</span>
              </div>
              <span className="text-xs text-slate-500 mt-2 block">
                {overview.pendingBizCount} ta tasdiq kutmoqda
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bugungi Bronlar</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {overview.todayBookingsCount}
              </div>
              <span className="text-xs text-slate-500 mt-2 block">
                Jami: {overview.bookingsCount} ta bron
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Elektron Navbat & Baholar</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {overview.queueTotal} <span className="text-xs font-normal text-slate-400">chipta</span>
              </div>
              <span className="text-xs text-amber-600 font-semibold mt-2 block">
                ★ {overview.avgRating} o‘rtacha baho ({overview.reviewsCount} sharh)
              </span>
            </div>
          </div>

          {/* Charts section: Daily Bookings & Categories */}
          {chartsData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Bookings Activity */}
              <div className="lg:col-span-2 min-w-0 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">So‘nggi 14 Kunlik Bronlar Faolligi</h3>
                    <p className="text-xs text-slate-400">Kunlik bronlar soni va xizmatlar aylanmasi</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg">
                    Real-vaqt dinamikasi
                  </span>
                </div>

                <div className="overflow-x-auto" aria-label="Kunlik bronlar grafigi" tabIndex={0}>
                <div className="h-64 min-w-[520px] flex items-end gap-2 pt-8 px-2 border-b border-slate-100">
                  {chartsData.dailyBookings?.map((item: any, idx: number) => {
                    const maxCount = Math.max(...chartsData.dailyBookings.map((b: any) => b.count), 5);
                    const heightPercent = Math.max((item.count / maxCount) * 100, 10);
                    return (
                      <div key={idx} className="flex-1 min-w-0 flex flex-col items-center group relative" title={`${item.date}: ${item.count} ta bron`}>
                        {/* Tooltip */}
                        <div className="hidden sm:group-hover:block absolute -top-12 bg-slate-900 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-lg">
                          <div>Sana: {item.date}</div>
                          <div>Bronlar: {item.count} ta</div>
                          <div>Tushum: {item.revenue?.toLocaleString()} so‘m</div>
                        </div>
                        {/* Bar */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t transition"
                        />
                        <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                          {item.date?.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                </div>
              </div>

              {/* Top Categories */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 mb-1">Kategoriyalar bo‘yicha Talab</h3>
                  <p className="text-xs text-slate-400 mb-4">Eng ko‘p bron qilinayotgan yo‘nalishlar</p>
                  <div className="space-y-3">
                    {chartsData.categoryStats?.slice(0, 5).map((cat: any, idx: number) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-800">{cat.name}</span>
                          <span className="text-slate-500 font-mono">{cat.bookings_count} ta ({cat.total_volume?.toLocaleString()} so‘m)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, (cat.bookings_count / (chartsData.categoryStats[0]?.bookings_count || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cities breakdown */}
                <div className="pt-6 border-t border-slate-100 mt-4">
                  <div className="text-xs font-bold text-slate-700 mb-2">Shaharlar bo‘yicha tarqalish:</div>
                  <div className="flex flex-wrap gap-2">
                    {chartsData.cityStats?.map((c: any, i: number) => (
                      <span key={i} className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 text-xs font-medium">
                        {c.name}: <strong className="text-slate-900">{c.businesses_count}</strong> biznes
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Health details */}
          {systemHealth && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">Ma’lumotlar Bazasi & Tizim Holati</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                {Object.entries(systemHealth.tableCounts ?? {}).map(([tableName, count]) => (
                  <div key={tableName} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[11px] font-mono text-slate-500 uppercase">{tableName}</span>
                    <div className="text-lg font-black text-slate-900 mt-0.5">{String(count)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SYSTEM REPORTS & ANALYTICS TAB */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Reports Header & Actions */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-black text-slate-900">Tizim Moliyaviy va Operatsion Hisobotlari</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Barcha ko‘rsatkichlar real vaqtda to‘g‘ridan-to‘g‘ri ma’lumotlar bazasidan hisoblanadi (Fake ma’lumotlar yo‘q)
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleExportReportsCSV}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Hisobotni CSV yuklab olish</span>
              </button>
              <button
                onClick={loadData}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                title="Ma’lumotlarni yangilash"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {reportsData ? (
            <>
              {/* Financial KPI Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jami Yakunlangan Aylanma</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                    {reportsData.financial.totalGrossRevenue?.toLocaleString()} <span className="text-xs font-normal text-slate-400">so‘m</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                    <span>Muvaffaqiyatli buyurtmalar:</span>
                    <strong className="text-slate-800">{reportsData.financial.completedCount} ta</strong>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Joriy Oylik Tushum</span>
                  <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    {reportsData.financial.monthlyGrossRevenue?.toLocaleString()} <span className="text-xs font-normal text-slate-400">so‘m</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                    <span>Joriy oy aylanmasi</span>
                    <span className="text-emerald-600 font-bold">Faol</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bugungi Tushum</span>
                  <div className="text-2xl font-black text-indigo-600 mt-1 font-mono">
                    {reportsData.financial.todayGrossRevenue?.toLocaleString()} <span className="text-xs font-normal text-slate-400">so‘m</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                    <span>Bugungi kun kesimi</span>
                    <span className="text-slate-700 font-bold">{new Date().toLocaleDateString('uz-UZ')}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">O‘rtacha Bron Qiymati</span>
                  <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    {reportsData.financial.avgBookingValue?.toLocaleString()} <span className="text-xs font-normal text-slate-400">so‘m</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                    <span>Jami barcha bronlar:</span>
                    <strong className="text-slate-800">{reportsData.financial.totalBookingsCount} ta</strong>
                  </div>
                </div>
              </div>

              {/* Status Breakdown & Business Health */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bookings Status Distribution */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Bronlar Holati Bo‘yicha Taqsimot</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-slate-700">Yakunlangan (COMPLETED)</span>
                      </div>
                      <span className="font-bold text-slate-900 font-mono">
                        {reportsData.financial.completedCount} ta ({reportsData.financial.totalBookingsCount > 0 ? Math.round((reportsData.financial.completedCount / reportsData.financial.totalBookingsCount) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-2 rounded-full" 
                        style={{ width: `${reportsData.financial.totalBookingsCount > 0 ? (reportsData.financial.completedCount / reportsData.financial.totalBookingsCount) * 100 : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                        <span className="font-semibold text-slate-700">Tasdiqlangan (CONFIRMED)</span>
                      </div>
                      <span className="font-bold text-slate-900 font-mono">{reportsData.financial.confirmedCount} ta</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-sky-500 h-2 rounded-full" 
                        style={{ width: `${reportsData.financial.totalBookingsCount > 0 ? (reportsData.financial.confirmedCount / reportsData.financial.totalBookingsCount) * 100 : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="font-semibold text-slate-700">Kutilmoqda (PENDING)</span>
                      </div>
                      <span className="font-bold text-slate-900 font-mono">{reportsData.financial.pendingBookingsCount} ta</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-2 rounded-full" 
                        style={{ width: `${reportsData.financial.totalBookingsCount > 0 ? (reportsData.financial.pendingBookingsCount / reportsData.financial.totalBookingsCount) * 100 : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                        <span className="font-semibold text-slate-700">Bekor qilingan (CANCELLED)</span>
                      </div>
                      <span className="font-bold text-slate-900 font-mono">{reportsData.financial.cancelledCount} ta</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-rose-400 h-2 rounded-full" 
                        style={{ width: `${reportsData.financial.totalBookingsCount > 0 ? (reportsData.financial.cancelledCount / reportsData.financial.totalBookingsCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Businesses Breakdown */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Muassasalar va Arizalar Holati</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400">Jami Ro‘yxatdan O‘tgan</span>
                      <div className="text-xl font-black text-slate-900 mt-1">{reportsData.businesses.total} ta</div>
                    </div>
                    <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                      <span className="text-[11px] font-bold text-emerald-700">Faol / Tasdiqlangan</span>
                      <div className="text-xl font-black text-emerald-800 mt-1">{reportsData.businesses.approved} ta</div>
                    </div>
                    <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
                      <span className="text-[11px] font-bold text-amber-800">Tasdiq Kutayotgan Arizalar</span>
                      <div className="text-xl font-black text-amber-900 mt-1">{reportsData.businesses.pending} ta</div>
                    </div>
                    <div className="bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-600">To‘xtatilgan (Suspended)</span>
                      <div className="text-xl font-black text-slate-800 mt-1">{reportsData.businesses.suspended} ta</div>
                    </div>
                    <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-100">
                      <span className="text-[11px] font-bold text-rose-700">Rad Etilgan</span>
                      <div className="text-xl font-black text-rose-800 mt-1">{reportsData.businesses.rejected} ta</div>
                    </div>
                    <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100">
                      <span className="text-[11px] font-bold text-indigo-700">Rasmiy Tasdiqlangan (Verified)</span>
                      <div className="text-xl font-black text-indigo-900 mt-1">{reportsData.businesses.verified} ta</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top 10 Performing Businesses Table */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-black text-slate-900">Eng Yuqori Natija Ko‘rsatgan Muassasalar (Top 10)</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Bajarilgan buyurtmalar va aylanma asosida</span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-center">№</th>
                      <th className="py-3 px-4">Muassasa Nomi</th>
                      <th className="py-3 px-4">Kategoriya & Shahar</th>
                      <th className="py-3 px-4">Mas’ul Shaxs</th>
                      <th className="py-3 px-3 text-center">Jami Bronlar</th>
                      <th className="py-3 px-3 text-center">Yakunlangan</th>
                      <th className="py-3 px-4 text-right">Jami Tushum</th>
                      <th className="py-3 px-3 text-center">Mijozlar Bahosi</th>
                      <th className="py-3 px-3 text-center">Holat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportsData.businesses.topPerformers?.map((b: any, idx: number) => (
                      <tr key={b.id ?? idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-center font-bold text-slate-400">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-900">{b.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {String(b.id ?? '').slice(0, 8)}...</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{b.category_name}</div>
                          <div className="text-[10px] text-slate-400">{b.city_name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{b.owner_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{b.owner_phone || '—'}</div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">{b.total_bookings}</td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-600">{b.completed_bookings}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 font-mono">
                          {b.total_revenue?.toLocaleString()} so‘m
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{asNumber(b.rating).toFixed(1)}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            b.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Services & Queue Performance Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Services */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Eng Ko‘p Bron Qilinadigan Xizmatlar</span>
                  </h3>
                  <div className="space-y-2.5">
                    {reportsData.topServices?.map((s: any, idx: number) => (
                      <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">{s.service_name}</div>
                            <div className="text-[10px] text-slate-400">{s.business_name} • {s.category_name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-slate-900 font-mono">{s.bookings_count} ta buyurtma</div>
                          <div className="text-[10px] text-emerald-600 font-bold font-mono">{s.total_revenue?.toLocaleString()} so‘m</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Queue Performance & Users Breakdown */}
                <div className="space-y-6">
                  {/* Queue Stats */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                    <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-600" />
                      <span>Jonli Navbat Samaradorligi</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Jami Chiptalar</span>
                        <div className="text-lg font-black text-slate-900 mt-0.5">{reportsData.queueStats?.total_tickets || 0}</div>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                        <span className="text-[10px] font-bold text-amber-700 uppercase">Kutilmoqda</span>
                        <div className="text-lg font-black text-amber-800 mt-0.5">{reportsData.queueStats?.waiting_count || 0}</div>
                      </div>
                      <div className="bg-sky-50 p-3 rounded-xl border border-sky-100">
                        <span className="text-[10px] font-bold text-sky-700 uppercase">Qabulda</span>
                        <div className="text-lg font-black text-sky-800 mt-0.5">{reportsData.queueStats?.serving_count || 0}</div>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">Bajarildi</span>
                        <div className="text-lg font-black text-emerald-800 mt-0.5">{reportsData.queueStats?.completed_count || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Users Breakdown */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span>Foydalanuvchilar va Xavfsizlik Holati</span>
                      </h3>
                      <button
                        onClick={() => setActiveTab('users')}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        Boshqarish →
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center mb-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400">Jami Akkauntlar</span>
                        <div className="text-lg font-black text-slate-900 mt-0.5">{reportsData.users.total}</div>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-700">Faol Akkauntlar</span>
                        <div className="text-lg font-black text-emerald-800 mt-0.5">{reportsData.users.active}</div>
                      </div>
                      <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                        <span className="text-[10px] font-bold text-rose-700">Bloklangan</span>
                        <div className="text-lg font-black text-rose-800 mt-0.5">{reportsData.users.blocked}</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {reportsData.users.roles?.map((r: any) => (
                        <div key={r.role} className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50">
                          <span className="font-bold text-slate-700 uppercase text-[11px]">{r.role}</span>
                          <span className="font-black text-slate-900 font-mono">{r.count} ta</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">Hisobot ma’lumotlari tayyorlanmoqda...</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. BUSINESSES TAB */}
      {/* ======================================================== */}
      {activeTab === 'businesses' && (
        <div className="space-y-4">
          {/* Telegram orqali kelgan arizalar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-sky-50 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>Telegram orqali kelgan arizalar</span>
                    {bizApplications.length > 0 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full">
                        {bizApplications.length} ta
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bot orqali to‘ldirilgan va ko‘rib chiqishni kutayotgan arizalar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadBusinessApplications}
                disabled={bizAppsLoading}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${bizAppsLoading ? 'animate-spin' : ''}`} />
                <span>Yangilash</span>
              </button>
            </div>

            <div className="p-4 sm:p-5">
              {bizAppsLoading && bizApplications.length === 0 && (
                <div className="py-10 text-center">
                  <RefreshCw className="w-6 h-6 text-slate-300 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Arizalar yuklanmoqda...</p>
                </div>
              )}

              {!bizAppsLoading && bizAppsError && (
                <div className="py-8 text-center">
                  <AlertCircle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                  <p className="text-xs text-rose-600 font-semibold">{bizAppsError}</p>
                  <button
                    type="button"
                    onClick={loadBusinessApplications}
                    className="mt-3 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                  >
                    Qayta urinish
                  </button>
                </div>
              )}

              {!bizAppsLoading && !bizAppsError && bizApplications.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">Hozircha yangi arizalar yo‘q.</p>
              )}

              {!bizAppsError && bizApplications.length > 0 && (
                <div className="space-y-4">
                  {bizApplications.map((app) => (
                    <BusinessApplicationCard
                      key={app.id}
                      app={app}
                      isExpanded={expandedBizAppId === app.id}
                      onToggleExpand={() => setExpandedBizAppId((cur) => (cur === app.id ? null : app.id))}
                      actionLoading={bizAppActionLoading === app.id}
                      onApprove={() => handleApproveBizApplication(app)}
                      onReject={() => handleRejectBizApplication(app)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bizSearch}
                onChange={(e) => setBizSearch(e.target.value)}
                placeholder="Biznes nomi, shahar yoki egasi..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={bizStatusFilter}
                onChange={(e) => setBizStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="ALL">Barcha Holatlar</option>
                <option value="PENDING">Kutayotgan (PENDING)</option>
                <option value="APPROVED">Tasdiqlangan (APPROVED)</option>
                <option value="SUSPENDED">To‘xtatilgan (SUSPENDED)</option>
                <option value="REJECTED">Rad etilgan (REJECTED)</option>
              </select>
            </div>
          </div>

          {/* Businesses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Biznes & Manzil</th>
                  <th className="py-3 px-4">Egasi & Telefon</th>
                  <th className="py-3 px-4">Tarif (1 oylik)</th>
                  <th className="py-3 px-4">Holat</th>
                  <th className="py-3 px-4">Telegram</th>
                  <th className="py-3 px-4">Verified</th>
                  <th className="py-3 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBusinesses.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{b.name}</span>
                        {b.is_sponsored === 1 && (
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-black rounded">
                            REKLAMA
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{b.city_name} — {b.category_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{b.address}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{b.owner_name}</div>
                      <div className="text-[11px] text-slate-500">{b.owner_email}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{b.phone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                        {b.subscription_plan_code || 'PRO'}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1">
                        1 oy amal qiladi
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {b.status === 'APPROVED' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Tasdiqlangan
                        </span>
                      )}
                      {b.status === 'PENDING' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          Kutilmoqda
                        </span>
                      )}
                      {b.status === 'SUSPENDED' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
                          To‘xtatilgan
                        </span>
                      )}
                      {b.status === 'REJECTED' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          Rad etilgan
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {b.telegram_chat_id ? (
                        <span className="text-[11px] text-sky-600 font-mono flex items-center gap-1 font-bold">
                          <Check className="w-3.5 h-3.5 text-sky-500" /> Ulangan
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Ulanmagan</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {b.is_verified === 1 ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Ha
                        </span>
                      ) : (
                        <span className="text-slate-400">Yo‘q</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* Inspect details button */}
                      <button
                        onClick={() => handleInspectBusiness(b)}
                        disabled={inspectLoading}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition text-[11px] cursor-pointer inline-flex items-center gap-1"
                        title="Tafsilotlar, xizmatlar, xodimlar va jonli navbat"
                      >
                        <Eye className="w-3 h-3 text-slate-600" />
                        <span>Tafsilotlar</span>
                      </button>

                      {/* Approval Workflow */}
                      {b.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleUpdateBusiness(b.id, { status: 'APPROVED' })}
                            disabled={actionLoading === b.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-[11px] cursor-pointer"
                          >
                            Tasdiqlash
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: b.id, name: b.name })}
                            disabled={actionLoading === b.id}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition text-[11px] cursor-pointer"
                          >
                            Rad etish
                          </button>
                        </>
                      )}

                      {b.status === 'APPROVED' && (
                        <>
                          <button
                            onClick={() => handleUpdateBusiness(b.id, { status: 'SUSPENDED' })}
                            disabled={actionLoading === b.id}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg transition text-[11px] cursor-pointer"
                          >
                            To‘xtatish
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: b.id, name: b.name })}
                            disabled={actionLoading === b.id}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition text-[11px] cursor-pointer"
                          >
                            Rad etish
                          </button>
                        </>
                      )}

                      {b.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleUpdateBusiness(b.id, { status: 'APPROVED' })}
                          disabled={actionLoading === b.id}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-[11px] cursor-pointer"
                        >
                          Tiklash
                        </button>
                      )}

                      {b.status === 'REJECTED' && (
                        <button
                          onClick={() => handleUpdateBusiness(b.id, { status: 'APPROVED' })}
                          disabled={actionLoading === b.id}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-[11px] cursor-pointer"
                        >
                          Qayta tasdiqlash
                        </button>
                      )}

                      <button
                        onClick={() => handleUpdateBusiness(b.id, { is_verified: b.is_verified !== 1 })}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-[11px] cursor-pointer"
                      >
                        {b.is_verified === 1 ? '✓ Verified' : '+ Verified'}
                      </button>

                      <button
                        onClick={() => handleExtendSubscription(b.id, 1)}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition text-[11px] cursor-pointer"
                      >
                        +1 oy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ALL BOOKINGS TAB */}
      {/* ======================================================== */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bookingSearch}
                onChange={(e) => {
                  setBookingSearch(e.target.value);
                  loadBookings(1, bookingStatusFilter, e.target.value);
                }}
                placeholder="Raqam, mijoz yoki muassasa..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={bookingStatusFilter}
                onChange={(e) => {
                  setBookingStatusFilter(e.target.value);
                  loadBookings(1, e.target.value, bookingSearch);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="ALL">Barcha Statuslar</option>
                <option value="CONFIRMED">Tasdiqlangan (CONFIRMED)</option>
                <option value="IN_PROGRESS">Jarayonda (IN_PROGRESS)</option>
                <option value="COMPLETED">Yakunlangan (COMPLETED)</option>
                <option value="CANCELLED">Bekor qilingan (CANCELLED)</option>
              </select>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Bron Raqami</th>
                  <th className="py-3 px-4">Muassasa</th>
                  <th className="py-3 px-4">Mijoz</th>
                  <th className="py-3 px-4">Xizmat & Xodim</th>
                  <th className="py-3 px-4">Sana & Vaqt</th>
                  <th className="py-3 px-4">Narx</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-black text-slate-900">
                      #{b.booking_number}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {b.business_name}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{b.customer_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{b.customer_phone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{b.service_name}</div>
                      <div className="text-[11px] text-slate-500">{b.staff_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{b.booking_date}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{b.start_time} - {b.end_time}</div>
                    </td>
                    <td className="py-3 px-4 font-black text-emerald-700">
                      {b.total_price_uzs?.toLocaleString()} so‘m
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : b.status === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-700'
                            : b.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {b.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'COMPLETED')}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition text-[10px] cursor-pointer"
                        >
                          Yakunlash
                        </button>
                      )}
                      {b.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'CANCELLED')}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition text-[10px] cursor-pointer"
                        >
                          Bekor qilish
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.1 REVIEWS MODERATION TAB */}
      {/* ======================================================== */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                <h3 className="text-sm font-black text-slate-900">Sharhlar va Fikr-mulohazalar Moderatsiyasi</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Faqat yakunlangan haqiqiy xizmatlardan so‘ng yozilgan sharhlar. Soxta yoki haqoratli izohlarni o‘chirish nazorati.
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-700">
              Jami: {reviews.length} ta sharh
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
            {reviews.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                Hozircha tizimda hech qanday sharh mavjud emas.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Sana & Vaqt</th>
                    <th className="py-3 px-4">Mijoz</th>
                    <th className="py-3 px-4">Muassasa</th>
                    <th className="py-3 px-4">Baho</th>
                    <th className="py-3 px-4">Sharh Matni</th>
                    <th className="py-3 px-4 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reviews.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                        {r.created_at ? r.created_at.slice(0, 16) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{r.customer_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{r.customer_phone || '—'}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {r.business_name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{r.rating}.0</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-sm">
                        <p className="line-clamp-2">{r.comment || '—'}</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteReview(r.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>O‘chirish</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.2 PROMOTIONS & TOP ADS TAB */}
      {/* ======================================================== */}
      {activeTab === 'promotions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black text-slate-900">Reklama & Top Joylar (Sponsored Promotions)</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Katalog va qidiruvda «REKLAMA» belgisi bilan eng yuqorida chiqadigan bizneslar kampaniyalari.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold">
              Faol kampaniyalar: {promotions.filter(p => p.status === 'ACTIVE').length} ta
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
            {promotions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                Hozircha hech qanday reklama kampaniyasi yaratilmagan.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Muassasa</th>
                    <th className="py-3 px-4">Holat</th>
                    <th className="py-3 px-4">Muddat</th>
                    <th className="py-3 px-4">Ko‘rishlar</th>
                    <th className="py-3 px-4">Bosishlar (Clicks)</th>
                    <th className="py-3 px-4">To‘lov & Byudjet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promotions.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                        {p.business_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            p.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.status === 'ACTIVE' ? 'FAOL' : 'TUGAGAN'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {p.start_date?.slice(0, 10)} — {p.end_date?.slice(0, 10)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {p.impressions || 0} marta
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {p.clicks || 0} ta
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{p.total_amount?.toLocaleString() || '150 000'} so‘m</span>
                        <div className="text-[10px] text-slate-400">{p.payment_method || 'Click'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SUBSCRIPTIONS & 1 MONTH MONITORING TAB */}
      {/* ======================================================== */}
      {activeTab === 'subscriptions' && subscriptionsData && (
        <div className="space-y-6">
          {/* Rules Banner */}
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black uppercase tracking-wider">Tarif Obunasi Qoidasi: 1 Oy Amal Qiladi</h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Har bir tarif faollashtirilgach roppa-rosa 30 kun (1 oy) amal qiladi. Tugashiga 3 kun qolganda biznes egasiga Telegram va in-app ogohlantirish avtomatik boradi.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold">
                Muddati o‘tgan: {subscriptionsData.subscriptions.filter(s => s.days_left <= 0).length} ta
              </span>
              <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold">
                Tugayotgan: {subscriptionsData.subscriptions.filter(s => s.days_left > 0 && s.days_left <= 3).length} ta
              </span>
            </div>
          </div>

          {/* PENDING TELEGRAM PAYMENTS SECTION */}
          {((subscriptionsData as any).pendingTransactions?.length > 0 || subscriptionsData.transactions?.filter(t => t.status === 'PENDING').length > 0) && (
            <div className="bg-white rounded-2xl border-2 border-indigo-300 p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
                    💳
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Tasdiqlash kutilayotgan Telegram to‘lovlari (@mansur_0511)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Biznes egalari Telegram orqali tarif sotib olish so‘rovini yuborgan. To‘lov kelib tushgach, tasdiqlang.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full self-start sm:self-auto">
                  {((subscriptionsData as any).pendingTransactions || subscriptionsData.transactions?.filter(t => t.status === 'PENDING')).length} ta kutilmoqda
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Sana</th>
                      <th className="py-2.5 px-4">Biznes Nomi</th>
                      <th className="py-2.5 px-4">Egasi & Telefon</th>
                      <th className="py-2.5 px-4">Tanlangan Tarif</th>
                      <th className="py-2.5 px-4">Summa</th>
                      <th className="py-2.5 px-4">Holat</th>
                      <th className="py-2.5 px-4 text-right">Tasdiqlash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(((subscriptionsData as any).pendingTransactions?.length > 0) 
                      ? (subscriptionsData as any).pendingTransactions 
                      : subscriptionsData.transactions?.filter(t => t.status === 'PENDING')
                    ).map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-amber-50/40 transition">
                        <td className="py-3 px-4 font-mono text-slate-500">{tx.created_at?.slice(0, 16)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{tx.business_name}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{tx.owner_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{tx.owner_phone}</div>
                        </td>
                        <td className="py-3 px-4 font-black text-indigo-700">{tx.plan_code} (1 oy)</td>
                        <td className="py-3 px-4 font-black text-emerald-700">{tx.amount_uzs?.toLocaleString()} so‘m</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            Kutilmoqda
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleConfirmPayment(tx.id)}
                            disabled={actionLoading === `pay-${tx.id}`}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-[11px] cursor-pointer inline-flex items-center gap-1 shadow-xs"
                          >
                            <span>✅ Tasdiqlash (+30 kun)</span>
                          </button>
                          <button
                            onClick={() => handleCancelPayment(tx.id)}
                            disabled={actionLoading === `pay-cancel-${tx.id}`}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-bold rounded-lg transition text-[11px] cursor-pointer"
                          >
                            Bekor qilish
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subscriptions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
            <h4 className="text-sm font-black text-slate-900 mb-4">Bizneslar va 1 Oylik Obuna Holati</h4>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Biznes Nomi</th>
                  <th className="py-3 px-4">Egasi & Telefon</th>
                  <th className="py-3 px-4">Tarif</th>
                  <th className="py-3 px-4">Tugash Sanasi</th>
                  <th className="py-3 px-4">Qolgan Muddat</th>
                  <th className="py-3 px-4">Holat</th>
                  <th className="py-3 px-4 text-right">Admin Harakati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptionsData.subscriptions.map((s) => {
                  const isExpired = s.days_left <= 0;
                  const isExpiringSoon = s.days_left > 0 && s.days_left <= 3;
                  const isTrial = Boolean(s.is_trial) && !isExpired;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                        {s.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{s.owner_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{s.owner_phone || s.phone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-indigo-700">{s.subscription_plan_code || 'PRO'}</div>
                        {isTrial && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200">
                            14 kunlik sinov
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {s.subscription_expires_at ? s.subscription_expires_at.slice(0, 10) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-black ${isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-600' : isTrial ? 'text-purple-600' : 'text-emerald-600'}`}>
                          {isExpired ? 'Tugagan' : `${Math.ceil(s.days_left)} kun`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            isExpired
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isTrial
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : isExpiringSoon
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isExpired ? 'Muddati tugadi' : isTrial ? 'Sinov davri (14 kun)' : isExpiringSoon ? 'Tugamoqda' : 'Faol'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleExtendSubscription(s.id, 1)}
                          disabled={actionLoading === `sub-${s.id}`}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-[11px] cursor-pointer"
                        >
                          +1 oy uzaytirish (30 kun)
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Transactions Log */}
          {subscriptionsData.transactions?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
              <h4 className="text-sm font-black text-slate-900 mb-4">So‘nggi Obuna To‘lovlari & Tranzaksiyalar</h4>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Sana</th>
                    <th className="py-3 px-4">Biznes</th>
                    <th className="py-3 px-4">Tarif</th>
                    <th className="py-3 px-4">Muddat</th>
                    <th className="py-3 px-4">Summa</th>
                    <th className="py-3 px-4">Usul</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptionsData.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{tx.created_at?.slice(0, 16)}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{tx.business_name}</td>
                      <td className="py-2.5 px-4 font-bold text-indigo-700">{tx.plan_code}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-700">{tx.duration_days} kun (1 oy)</td>
                      <td className="py-2.5 px-4 font-black text-emerald-700">{tx.amount_uzs?.toLocaleString()} so‘m</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">{tx.payment_method}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === 'COMPLETED' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : tx.status === 'PENDING' 
                            ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {tx.status === 'COMPLETED' ? 'To‘landi' : tx.status === 'PENDING' ? 'Kutilmoqda' : 'Bekor qilindi'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. TELEGRAM BOT NOTIFICATIONS TAB */}
      {/* ======================================================== */}
      {activeTab === 'telegram' && (
        <div className="space-y-6">
          {/* Telegram Test & Configuration Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direct Test Dispatcher */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Send className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-black text-slate-900">Telegram Sinov Xabari Yuborish</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Istalgan Telegram foydalanuvchisi yoki guruh chat_id sini kiritib xabarnomani sinab ko‘ring.
              </p>

              <form onSubmit={handleSendTelegramTest} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Telegram Chat ID:
                  </label>
                  <input
                    type="text"
                    value={testChatId}
                    onChange={(e) => setTestChatId(e.target.value)}
                    placeholder="Masalan: 123456789 yoki -10012345678"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-sky-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Xabar Matni:
                  </label>
                  <textarea
                    rows={3}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-sky-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegramga Yuborish</span>
                  </button>
                  {testStatus && (
                    <span className="text-xs font-semibold text-slate-600">{testStatus}</span>
                  )}
                </div>
              </form>
            </div>

            {/* Telegram Bot Capabilities & Info */}
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-5 h-5 text-sky-700" />
                  <h3 className="text-sm font-black text-sky-950">Avtomatik Telegram Xabarnomalar</h3>
                </div>
                <p className="text-xs text-sky-800 leading-relaxed">
                  NavbatBor quyidagi hodisalarda Telegram orqali xabar yuboradi:
                </p>

                <ul className="text-xs text-sky-900 space-y-2 mt-3 list-disc pl-4">
                  <li><strong>Yangi bron kelganda:</strong> Biznes egasi va mijozga to‘liq ma’lumot.</li>
                  <li><strong>Jonli navbat chaqirilganda:</strong> Mijozga chipta raqami bilan bildirishnoma.</li>
                  <li><strong>Tarif tugashiga 3 kun qolganda:</strong> 1 oylik obunani uzaytirish ogohlantirishi.</li>
                  <li><strong>Tarif tugaganda:</strong> Xizmatlarni to‘xtab qolmasligi haqida darhol xabar.</li>
                </ul>
              </div>

              <div className="pt-4 mt-4 border-t border-sky-200/60 text-[11px] text-sky-700">
                💡 <em>Token kiritilmagan holatda barcha xabarlar simulyatsiya qilinib, pastdagi jurnalda saqlanadi.</em>
              </div>
            </div>
          </div>

          {/* Telegram Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
            <h4 className="text-sm font-black text-slate-900 mb-4">Telegram Xabarnomalar Jurnali ({telegramLogs.length})</h4>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Vaqt</th>
                  <th className="py-3 px-4">Qabul qiluvchi</th>
                  <th className="py-3 px-4">Chat ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Xabar Mazmuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {telegramLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{log.created_at}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100">
                        {log.recipient_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{log.chat_id || 'Noma‘lum'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'SENT'
                            ? 'bg-emerald-50 text-emerald-700'
                            : log.status === 'SENT_SIMULATED'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-md truncate font-sans">
                      {log.message?.replace(/<[^>]*>?/gm, '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. USERS TAB */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
          {credentialsBanner && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start justify-between gap-3 text-emerald-900 text-xs animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-950 text-sm mb-1">Muvaffaqiyatli bajarildi!</div>
                  <p className="font-medium text-emerald-800 leading-relaxed font-mono select-all bg-emerald-100/60 p-2 rounded-lg border border-emerald-200">
                    {credentialsBanner}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-1">Ushbu login va parolni biznes egasiga yetkazishingiz mumkin.</p>
                </div>
              </div>
              <button aria-label="Yopish"
                onClick={() => setCredentialsBanner(null)}
                className="p-1 text-emerald-600 hover:text-emerald-800 rounded-lg cursor-pointer transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">Foydalanuvchilar Boshqaruvi & Xavfsizlik</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Foydalanuvchilarni qidirish, shubhali akkauntlarni darhol bloklash (sessiyalari o‘chiriladi) va login/parol berish
              </p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => {
                  setShowCreateUserModal(true);
                  setUserModalError(null);
                  setNewUserPassword(Math.random().toString(36).slice(-8) + 'B1!');
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Yangi Biznes Egasi Yaratish</span>
              </button>
            </div>
          </div>

          {/* User Filters & Stats */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 w-full">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Ism, email yoki telefon raqami bo‘yicha qidirish..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer w-full sm:w-auto"
                >
                  <option value="ALL">Barcha Rollar</option>
                  <option value="CUSTOMER">Mijoz (CUSTOMER)</option>
                  <option value="BUSINESS_OWNER">Biznes Egasi (BUSINESS_OWNER)</option>
                  <option value="STAFF">Xodim (STAFF)</option>
                  <option value="ADMIN">Administrator (ADMIN)</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer w-full sm:w-auto"
                >
                  <option value="ALL">Barcha Statuslar</option>
                  <option value="ACTIVE">Faol (ACTIVE)</option>
                  <option value="BLOCKED">Bloklangan (BLOCKED)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold shrink-0">
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
                Topildi: {filteredUsers.length} ta
              </span>
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
                Faol: {users.filter(u => u.status === 'ACTIVE').length}
              </span>
              <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                Bloklangan: {users.filter(u => u.status === 'BLOCKED').length}
              </span>
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Foydalanuvchi</th>
                <th className="py-3 px-4">Email & Telefon</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Xavfsizlik & Bloklash</th>
                <th className="py-3 px-4 text-center">Parol Berish</th>
                <th className="py-3 px-4 text-right">Rolni O‘zgartirish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    Foydalanuvchi topilmadi
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {u.id.slice(0, 8)}...</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-700 font-mono font-medium">{u.email}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.phone || '—'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${
                        u.role === 'ADMIN'
                          ? 'bg-rose-100 text-rose-800 font-black'
                          : u.role === 'BUSINESS_OWNER'
                          ? 'bg-indigo-100 text-indigo-800 font-black'
                          : u.role === 'STAFF'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {u.status === 'ACTIVE' ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Faol</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-rose-600" />
                            <span>Bloklangan</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Security & Block/Unblock toggle */}
                    <td className="py-3 px-4 text-center">
                      {u.role === 'ADMIN' ? (
                        <span className="text-[11px] text-slate-400 font-medium italic">Himoyalangan</span>
                      ) : u.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBlockModalTarget(u);
                            setBlockReason('');
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                          title="Foydalanuvchini bloklash va sessiyalarini o‘chirish"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Bloklash</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleUserBlock(u, 'ACTIVE')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                          title="Foydalanuvchini qayta faollashtirish"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>Faollashtirish</span>
                        </button>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setResetPasswordTarget(u);
                          setResetPasswordValue(Math.random().toString(36).slice(-8) + 'P1!');
                          setResetModalError(null);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg font-semibold text-[11px] transition inline-flex items-center gap-1 cursor-pointer border border-slate-200"
                      >
                        <Key className="w-3 h-3 text-slate-400" />
                        <span>Parol berish</span>
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {u.role === 'ADMIN' ? (
                        <span className="text-slate-400 text-[11px]">ADMIN</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold cursor-pointer"
                        >
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="BUSINESS_OWNER">BUSINESS_OWNER</option>
                          <option value="STAFF">STAFF</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. AUDIT LOGS TAB */}
      {/* ======================================================== */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-900">Audit Jurnali & Xavfsizlik</h3>
            <p className="text-xs text-slate-400">Har bir muhim operatsiya va administrator harakatlari jurnali</p>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Sana & Vaqt</th>
                <th className="py-3 px-4">Foydalanuvchi</th>
                <th className="py-3 px-4">Harakat</th>
                <th className="py-3 px-4">Tafsilotlar</th>
                <th className="py-3 px-4">IP Manzil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">{log.created_at}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{log.user_name || 'Tizim'}</td>
                  <td className="py-3 px-4 font-mono text-indigo-700 font-bold">{log.action}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{log.details || '—'}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono">{log.ip_address || '127.0.0.1'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================================== */}
      {/* REJECTION REASON MODAL */}
      {/* ======================================================== */}
      {rejectModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Arizani rad etish</span>
              </div>
              <button aria-label="Yopish"
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-600">
                <strong className="text-slate-900">{rejectModal.name}</strong> arizasini rad etish sababini kiriting.
                Ushbu sabab biznes egasining shaxsiy kabinetida va bildirishnomada ko‘rsatiladi:
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masalan: Telefon raqam yoki manzil noto‘g‘ri ko‘rsatilgan, xizmatlar ma’lumoti yetarli emas..."
                rows={3}
                className="w-full mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-rose-500 focus:bg-white"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading === rejectModal.id}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer"
              >
                Rad etishni tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BUSINESS INSPECTION MODAL */}
      {/* ======================================================== */}
      {inspectBusiness && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900">{inspectBusiness.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                    {inspectBusiness.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inspectBusiness.city_name} • {inspectBusiness.category_name} • {inspectBusiness.address}
                </p>
              </div>
              <button aria-label="Yopish"
                onClick={() => setInspectBusiness(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {/* Business Owner info */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Muassasa Egasi</span>
                <div className="mt-2 text-xs space-y-1">
                  <div><strong>Ismi:</strong> {inspectBusiness.owner_name}</div>
                  <div><strong>Email:</strong> {inspectBusiness.owner_email}</div>
                  <div><strong>Telefon:</strong> <span className="font-mono">{inspectBusiness.phone}</span></div>
                  <div><strong>Ish vaqti:</strong> {inspectBusiness.opening_time} - {inspectBusiness.closing_time}</div>
                </div>
              </div>

              {/* Live Queue status */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jonli Navbat Holati</span>
                <div className="mt-2 text-xs">
                  <div className="text-sm font-black text-slate-900">
                    {inspectBusiness.queueEntries?.length || 0} nafar mijoz navbatda
                  </div>
                  <div className="text-slate-500 text-[11px] mt-1">
                    Jonli navbat kodi: <span className="font-mono font-bold text-emerald-600">{inspectBusiness.slug}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Services */}
            <div className="mt-6">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                Xizmatlar ({inspectBusiness.services?.length || 0})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {inspectBusiness.services?.map((s: any) => (
                  <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{s.name}</div>
                      <div className="text-[10px] text-slate-400">{s.duration_minutes} daqiqa</div>
                    </div>
                    <div className="font-black text-emerald-600 font-mono">
                      {s.price?.toLocaleString()} so‘m
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff */}
            <div className="mt-6">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                Xodimlar & Mutaxassislar ({inspectBusiness.staff?.length || 0})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {inspectBusiness.staff?.map((st: any) => (
                  <div key={st.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{st.name}</div>
                      <div className="text-[10px] text-slate-400">{st.role_title || st.specialty || 'Mutaxassis'}</div>
                    </div>
                    <div className="text-[11px] text-amber-500 font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{st.rating || '5.0'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              {inspectBusiness.status === 'PENDING' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleUpdateBusiness(inspectBusiness.id, { status: 'APPROVED' });
                      setInspectBusiness(null);
                    }}
                    disabled={actionLoading === inspectBusiness.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                  >
                    Arizani Tasdiqlash
                  </button>
                  <button
                    onClick={() => {
                      setRejectModal({ id: inspectBusiness.id, name: inspectBusiness.name });
                      setInspectBusiness(null);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Rad Etish
                  </button>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500">
                  Holat: <span className="uppercase text-slate-800">{inspectBusiness.status}</span>
                </span>
              )}
              <button
                onClick={() => setInspectBusiness(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE USER / PROVISION BUSINESS OWNER MODAL */}
      {/* ======================================================== */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Yangi Akkaunt Yaratish</h3>
                  <p className="text-xs text-slate-400">Biznes egasiga login va parol topshirish uchun</p>
                </div>
              </div>
              <button aria-label="Yopish"
                onClick={() => setShowCreateUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userModalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{userModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Ism Familiya / Mas’ul Shaxs
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Sardor Rahimov"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Email Manzil (Login sifatida ishlatiladi)
                </label>
                <input
                  type="email"
                  required
                  placeholder="biznes@navbatbor.uz"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Telefon Raqam
                </label>
                <input
                  type="text"
                  placeholder="+998 90 123 45 67"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Akkaunt Roli
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold cursor-pointer"
                >
                  <option value="BUSINESS_OWNER">BUSINESS_OWNER (Biznes Egasi)</option>
                  <option value="STAFF">STAFF (Xodim / Operator)</option>
                  <option value="CUSTOMER">CUSTOMER (Oddiy Mijoz)</option>
                  <option value="ADMIN">ADMIN (Super Administrator)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Boshlang‘ich Parol
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewUserPassword(Math.random().toString(36).slice(-8) + 'B1!')}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Yangi parol yaratish
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Kamida 6 ta belgi"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold text-blue-700"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Ushbu parolni biznes egasiga topshirasiz.</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={userModalLoading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {userModalLoading ? 'Yaratilmoqda...' : 'Akkauntni Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* RESET / ASSIGN USER PASSWORD MODAL */}
      {/* ======================================================== */}
      {resetPasswordTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Parolni O‘zgartirish</h3>
                  <p className="text-xs text-slate-400">Yangi login kalitini o‘rnatish</p>
                </div>
              </div>
              <button aria-label="Yopish"
                onClick={() => setResetPasswordTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
              <div className="font-bold text-slate-800">{resetPasswordTarget.name}</div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">{resetPasswordTarget.email}</div>
              <div className="mt-1">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                  {resetPasswordTarget.role}
                </span>
              </div>
            </div>

            {resetModalError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{resetModalError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Yangi Parol
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordValue(Math.random().toString(36).slice(-8) + 'P1!')}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Avto-parol
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Kamida 6 ta belgi"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-indigo-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={resetModalLoading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {resetModalLoading ? 'Saqlanmoqda...' : 'Parolni Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BLOCK USER CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {blockModalTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Foydalanuvchini Bloklash</h3>
                  <p className="text-xs text-slate-500">Kirish huquqini darhol to‘xtatish</p>
                </div>
              </div>
              <button aria-label="Yopish"
                onClick={() => setBlockModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900">
              <p className="font-bold mb-1">Diqqat: Ushbu amal quyidagilarni keltirib chiqaradi:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-800">
                <li>Foydalanuvchining barcha faol qurilmalardagi sessiyalari darhol o‘chiriladi.</li>
                <li>U tizimga qayta kira olmaydi va API so‘rovlari rad etiladi.</li>
                <li>Harakat audit jurnaliga administrator nomidan yozib qoldiriladi.</li>
              </ul>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-4">
              <div><strong className="text-slate-700">Foydalanuvchi:</strong> {blockModalTarget.name}</div>
              <div><strong className="text-slate-700">Email:</strong> <span className="font-mono">{blockModalTarget.email}</span></div>
              <div><strong className="text-slate-700">Roli:</strong> <span className="font-bold uppercase text-[11px]">{blockModalTarget.role}</span></div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleToggleUserBlock(blockModalTarget, 'BLOCKED', blockReason);
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                  Bloklash Sababi (ixtiyoriy):
                </label>
                <textarea
                  rows={2}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Masalan: Tizim xavfsizlik qoidalarini buzish, spam yoki shubhali harakatlar..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBlockModalTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={blockLoading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{blockLoading ? 'Bloklanmoqda...' : 'Tasdiqlash va Bloklash'}</span>
                </button>
              </div>
            </form>
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

