import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, DollarSign, TrendingUp, CheckCircle2, Clock, 
  AlertTriangle, AlertCircle, Plus, Search, Filter, Download, Send, Eye, Shield, 
  MessageSquare, Briefcase, Award, ArrowUpRight, Check, X, Phone, 
  MapPin, RefreshCw, ChevronRight, Lock, ExternalLink, ShieldCheck, 
  FileText, Sparkles, BarChart3, UserCheck, HelpCircle
} from 'lucide-react';
import { api } from '../api';
import { 
  User, OperatingPartnerOverview, CRMLead, CRMLeadStage, 
  PartnerCommission, PartnerReport, SupportTicket, OperatingAuditLog,
  OperatingPartnerKPI
} from '../types';

interface OperatingPartnerDashboardProps {
  currentUser: User;
  onSelectBusiness?: (biz: any) => void;
  onSwitchToAdmin?: () => void;
}

export const OperatingPartnerDashboard: React.FC<OperatingPartnerDashboardProps> = ({
  currentUser,
  onSelectBusiness,
  onSwitchToAdmin
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'businesses' | 'crm' | 'commissions' | 'kpis' | 'reports' | 'support' | 'audit'
  >('overview');

  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<OperatingPartnerOverview | null>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [commissionsData, setCommissionsData] = useState<{ commissions: PartnerCommission[]; summary: any } | null>(null);
  const [reports, setReports] = useState<PartnerReport[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<OperatingAuditLog[]>([]);

  // Search & Filter States
  const [bizSearch, setBizSearch] = useState<string>('');
  const [bizStatusFilter, setBizStatusFilter] = useState<string>('ALL');
  const [crmSearch, setCrmSearch] = useState<string>('');
  const [crmStageFilter, setCrmStageFilter] = useState<string>('ALL');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');

  // Modals
  const [showAddBizModal, setShowAddBizModal] = useState<boolean>(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showTicketModal, setShowTicketModal] = useState<boolean>(false);
  const [selectedLeadForConvert, setSelectedLeadForConvert] = useState<CRMLead | null>(null);
  const [selectedBizForTariff, setSelectedBizForTariff] = useState<any | null>(null);
  const [selectedReportDetail, setSelectedReportDetail] = useState<PartnerReport | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Form States
  const [newBizForm, setNewBizForm] = useState({
    name: '',
    category_id: 'cat-barber',
    address: 'Qarshi sh., ',
    phone: '+998',
    owner_name: '',
    owner_email: '',
    owner_phone: '+998',
    owner_password: 'password123',
    subscription_plan_code: 'START',
    description: ''
  });

  const [newLeadForm, setNewLeadForm] = useState({
    business_name: '',
    owner_name: '',
    phone: '+998',
    telegram_username: '@',
    address: 'Qarshi sh., ',
    business_type: 'Go‘zallik saloni',
    deal_value_uzs: 149000,
    status: 'LEAD' as CRMLeadStage,
    notes: '',
    next_contact_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  });

  const [reportForm, setReportForm] = useState({
    report_type: 'WEEKLY' as 'WEEKLY' | 'MONTHLY',
    period_label: '',
    period_start: '',
    period_end: '',
    new_businesses_count: 0,
    total_businesses_count: 0,
    total_revenue_uzs: 0,
    partner_commission_uzs: 0,
    new_customers_count: 0,
    completed_work: '',
    issues_summary: '',
    next_week_plan: ''
  });

  const [newTicketForm, setNewTicketForm] = useState({
    business_name: '',
    customer_name: '',
    customer_phone: '+998',
    subject: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  });

  const isFounder = currentUser.role === 'FOUNDER' || currentUser.role === 'ADMIN' || currentUser.email === 'rasulovjahongir074@gmail.com';

  const showNotification = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const showErrorMessage = (msg: string) => {
    setActionErrorMessage(msg);
    setTimeout(() => setActionErrorMessage(null), 5000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [ov, bizList, leadsList, comms, repList, tList, aList] = await Promise.all([
        api.getPartnerOverview(),
        api.getPartnerBusinesses(),
        api.getCRMLeads(),
        api.getPartnerCommissions(),
        api.getPartnerReports(),
        api.getPartnerSupportTickets(),
        api.getPartnerAuditLogs()
      ]);
      setOverview(ov);
      setBusinesses(bizList);
      setLeads(leadsList);
      setCommissionsData(comms);
      setReports(repList);
      setTickets(tList);
      setAuditLogs(aList);
    } catch (err) {
      console.error('Error loading partner dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPartnerBusiness(newBizForm);
      showNotification(`"${newBizForm.name}" muvaffaqiyatli ro‘yxatdan o‘tkazildi!`);
      setShowAddBizModal(false);
      setNewBizForm({
        name: '',
        category_id: 'cat-barber',
        address: 'Qarshi sh., ',
        phone: '+998',
        owner_name: '',
        owner_email: '',
        owner_phone: '+998',
        owner_password: 'password123',
        subscription_plan_code: 'START',
        description: ''
      });
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'Xatolik yuz berdi');
    }
  };

  const handleUpdateBizStatus = async (id: string, status: string) => {
    try {
      await api.updatePartnerBusinessStatus(id, status);
      showNotification(`Biznes holati "${status}" ga o‘zgartirildi.`);
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'Statusni o‘zgartirib bo‘lmadi');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCRMLead(newLeadForm);
      showNotification(`"${newLeadForm.business_name}" lead bazasiga qo‘shildi!`);
      setShowAddLeadModal(false);
      setNewLeadForm({
        business_name: '',
        owner_name: '',
        phone: '+998',
        telegram_username: '@',
        address: 'Qarshi sh., ',
        business_type: 'Go‘zallik saloni',
        deal_value_uzs: 149000,
        status: 'LEAD',
        notes: '',
        next_contact_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
      });
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'Lead yaratishda xatolik');
    }
  };

  const handleAdvanceLeadStage = async (id: string, stage: CRMLeadStage) => {
    try {
      await api.updateCRMLeadStage(id, stage);
      showNotification(`Lead bosqichi "${stage}" ga yangilandi!`);
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'Bosqichni o‘zgartirib bo‘lmadi');
    }
  };

  const handleConvertLead = async (leadId: string, planCode: string) => {
    try {
      const res = await api.convertCRMLeadToBusiness(leadId, { plan_code: planCode, owner_password: 'password123' });
      showNotification(res.message || 'Lead muvaffaqiyatli biznesga aylantirildi!');
      setSelectedLeadForConvert(null);
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'Aylantirishda xatolik yuz berdi');
    }
  };

  const handleOpenDraftReport = async (type: 'WEEKLY' | 'MONTHLY') => {
    try {
      const draft = await api.generatePartnerReportDraft(type);
      setReportForm({
        report_type: type,
        period_label: draft.period_label || `${type}: Davr`,
        period_start: draft.period_start || '',
        period_end: draft.period_end || '',
        new_businesses_count: draft.new_businesses_count || 0,
        total_businesses_count: draft.total_businesses_count || 0,
        total_revenue_uzs: draft.total_revenue_uzs || 0,
        partner_commission_uzs: draft.partner_commission_uzs || 0,
        new_customers_count: draft.new_customers_count || 0,
        completed_work: '1. Qarshi shahrida mahalliy bizneslar bilan uchrashuvlar o‘tkazildi.\n2. Elektron navbat va QR-kod tizimi sozlandi.\n3. Xodimlar va qabul jadvallari kiritildi.',
        issues_summary: 'Kichik texnik masalalar zudlik bilan joyida hal qilindi.',
        next_week_plan: '1. Yangi 3 ta muassasani ulash.\n2. Telegram bot eslatmalarini keng targ‘ib qilish.'
      });
      setShowReportModal(true);
    } catch (err) {
      showErrorMessage('Qoralama tuzishda xatolik');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.submitPartnerReport(reportForm);
      showNotification('Hisobot Founder hisobiga va Telegram orqali yuborildi!');
      setShowReportModal(false);
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'Hisobotni yuborishda xatolik');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSupportTicket(newTicketForm);
      showNotification('Yangi support murojaati ro‘yxatga olindi!');
      setShowTicketModal(false);
      setNewTicketForm({
        business_name: '',
        customer_name: '',
        customer_phone: '+998',
        subject: '',
        description: '',
        priority: 'MEDIUM'
      });
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'Murojaat yaratishda xatolik');
    }
  };

  const handleSolveTicket = async (id: string) => {
    const notes = prompt('Hal qilinish izohi (Resolution notes):', 'Muammo muvaffaqiyatli hal qilindi.');
    if (!notes) return;
    try {
      await api.updateSupportTicketStatus(id, { status: 'RESOLVED', resolution_notes: notes });
      showNotification('Murojaat muvaffaqiyatli hal qilindi!');
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'Statusni yangilashda xatolik');
    }
  };

  const handleSettlePayout = async (commId: string) => {
    if (!isFounder) return;
    const notes = prompt('To‘lov izohi / kvitansiya raqami:', 'Founder tomonidan bank kartasiga o‘tkazildi.');
    if (!notes) return;
    try {
      await api.settleCommissionPayout(commId, notes);
      showNotification('Komissiya to‘lovi tasdiqlandi!');
      loadAllData();
    } catch (err: any) {
      showErrorMessage(err.message || 'To‘lovni tasdiqlashda xatolik');
    }
  };

  const handleExportCommissionsCSV = () => {
    if (!commissionsData?.commissions?.length) {
      showErrorMessage('Eksport qilish uchun komissiya ma’lumotlari mavjud emas');
      return;
    }
    const headers = ['ID', 'Sana', 'Muassasa', 'Tarif', 'Jami to‘lov (so‘m)', 'Hamkor ulushi (30%)', 'NavbatBor ulushi (70%)', 'Holat', 'Izoh'];
    const rows = commissionsData.commissions.map(c => [
      c.id,
      c.created_at?.slice(0, 10) || '',
      `"${c.business_name.replace(/"/g, '""')}"`,
      c.plan_code,
      c.total_amount_uzs,
      c.partner_share_uzs,
      c.navbatbor_share_uzs,
      c.payment_status,
      `"${(c.payout_notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NavbatBor_Qarshi_Komissiya_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered views
  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(bizSearch.toLowerCase()) || 
                          b.owner_name?.toLowerCase().includes(bizSearch.toLowerCase()) ||
                          b.phone?.includes(bizSearch);
    const matchesStatus = bizStatusFilter === 'ALL' || b.status === bizStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.business_name.toLowerCase().includes(crmSearch.toLowerCase()) ||
                          l.owner_name.toLowerCase().includes(crmSearch.toLowerCase()) ||
                          l.phone.includes(crmSearch);
    const matchesStage = crmStageFilter === 'ALL' || l.status === crmStageFilter;
    return matchesSearch && matchesStage;
  });

  const filteredTickets = tickets.filter(t => {
    return ticketStatusFilter === 'ALL' || t.status === ticketStatusFilter;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20">
      {/* Top Banner / Header */}
      <div className="bg-slate-950 border-b border-slate-800 sticky top-16 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Operating Partner Boshqaruv Markazi
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Qarshi Operatsiyalari
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mas’ul: <span className="text-slate-200 font-semibold">{currentUser.name}</span> ({currentUser.role})
                  {isFounder && <span className="ml-2 text-rose-400 font-bold">• Loyiha Egasi (Founder) Rejimi</span>}
                </p>
              </div>
            </div>

            {/* Quick action buttons & Founder Switch */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => setShowAddBizModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yangi Biznes</span>
              </button>

              <button
                onClick={() => setShowAddLeadModal(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Yangi Lead (CRM)</span>
              </button>

              <button
                onClick={() => handleOpenDraftReport('WEEKLY')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Hisobot Yuborish</span>
              </button>

              {isFounder && onSwitchToAdmin && (
                <button
                  onClick={onSwitchToAdmin}
                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Super Admin Panel</span>
                </button>
              )}

              <button
                onClick={loadAllData}
                title="Yangilash"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {actionSuccessMessage && (
            <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
          )}

          {actionErrorMessage && (
            <div className="mt-3 p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionErrorMessage}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mt-4 pt-2 border-t border-slate-800/80 text-xs font-bold">
            {[
              { id: 'overview', label: 'Boshqaruv Markazi', icon: BarChart3 },
              { id: 'businesses', label: `Bizneslar (${businesses.length})`, icon: Building2 },
              { id: 'crm', label: `CRM Voronka (${leads.length})`, icon: TrendingUp },
              { id: 'commissions', label: 'Komissiya (30/70)', icon: DollarSign },
              { id: 'kpis', label: 'KPI Ko‘rsatkichlar', icon: Award },
              { id: 'reports', label: `Hisobotlar (${reports.length})`, icon: FileText },
              { id: 'support', label: `Support (${tickets.filter(t => t.status !== 'RESOLVED').length})`, icon: MessageSquare },
              { id: 'audit', label: 'Xavfsizlik & Audit', icon: ShieldCheck }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl whitespace-nowrap transition cursor-pointer ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Top 4 Primary Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Bugungi Tushum</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {overview.todayRevenue.toLocaleString()} <span className="text-xs font-bold text-slate-400">so‘m</span>
                </div>
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Real vaqt to‘lovlari</span>
                </p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Oylik Tushum</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {overview.monthlyRevenue.toLocaleString()} <span className="text-xs font-bold text-slate-400">so‘m</span>
                </div>
                <p className="text-[11px] text-blue-400 mt-1 font-semibold">
                  Hamkor ulushi (30%): <strong className="text-white">{overview.partnerMonthlyCommission.toLocaleString()} so‘m</strong>
                </p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Faol Bizneslar</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {overview.activeBusinessesCount} <span className="text-xs font-bold text-slate-400">/ {overview.totalBusinessesCount} ta</span>
                </div>
                <p className="text-[11px] text-indigo-300 mt-1 font-semibold">
                  +{overview.newBusinessesThisMonth} ta yangi bu oyda
                </p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Elektron Navbatlar</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {overview.totalQueueCount} <span className="text-xs font-bold text-slate-400">navbat</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Bekor qilingan: <span className="text-rose-400 font-bold">{overview.cancelledQueueCount} ta</span>
                </p>
              </div>
            </div>

            {/* Middle Grid: Tariffs Distribution & CRM Voronka preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tariffs Breakdown */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center justify-between">
                  <span>Faol Tariflar Taqsimoti</span>
                  <span className="text-emerald-400 font-extrabold text-[11px]">Qarshi</span>
                </h3>
                <div className="space-y-3">
                  {[
                    { code: 'FREE', name: 'Bepul Sinov', price: '0 so‘m', count: overview.activeTariffsBreakdown.FREE, color: 'bg-slate-500' },
                    { code: 'START', name: 'Start Tarifi', price: '149 000 so‘m', count: overview.activeTariffsBreakdown.START, color: 'bg-blue-500' },
                    { code: 'PRO', name: 'Pro Tarifi', price: '299 000 so‘m', count: overview.activeTariffsBreakdown.PRO, color: 'bg-indigo-500' },
                    { code: 'BUSINESS', name: 'Business VIP', price: '599 000 so‘m', count: overview.activeTariffsBreakdown.BUSINESS, color: 'bg-emerald-500' },
                  ].map(t => (
                    <div key={t.code} className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${t.color}`} />
                        <div>
                          <p className="text-xs font-bold text-white">{t.name}</p>
                          <p className="text-[10px] text-slate-400">{t.price}</p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-white px-2.5 py-1 bg-slate-800 rounded-lg">
                        {t.count} ta
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CRM Pipeline Voronka Preview */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                    Sotuv Voronkasi (CRM)
                  </h3>
                  <button 
                    onClick={() => setActiveTab('crm')}
                    className="text-[11px] text-emerald-400 font-bold hover:underline"
                  >
                    Barchasi &rarr;
                  </button>
                </div>
                <div className="space-y-2">
                  {[
                    { stage: 'LEAD', label: 'Yangi Leadlar', count: overview.crmPipelineCounts['LEAD'] || 0, color: 'bg-slate-600' },
                    { stage: 'CONTACTED', label: 'Aloqaga chiqildi', count: overview.crmPipelineCounts['CONTACTED'] || 0, color: 'bg-blue-600' },
                    { stage: 'DEMO', label: 'Demo namoyish', count: overview.crmPipelineCounts['DEMO'] || 0, color: 'bg-amber-600' },
                    { stage: 'TRIAL', label: 'Sinov rejimi', count: overview.crmPipelineCounts['TRIAL'] || 0, color: 'bg-purple-600' },
                    { stage: 'PAID', label: 'To‘lov qilgan', count: overview.crmPipelineCounts['PAID'] || 0, color: 'bg-emerald-600' },
                    { stage: 'ACTIVE', label: 'Doimiy mijoz', count: overview.crmPipelineCounts['ACTIVE'] || 0, color: 'bg-teal-500' },
                  ].map(s => (
                    <div key={s.stage} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{s.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-900 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${s.color}`}
                            style={{ width: `${Math.min(100, Math.max(10, s.count * 20))}%` }}
                          />
                        </div>
                        <span className="font-bold text-white w-5 text-right">{s.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commission & Partnership 30/70 Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/30 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Hamkorlik Modeli: 30% / 70%
                    </span>
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white">Operating Partner Komissiyasi</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Faqat mijoz haqiqiy to‘lov qilganda avtomatik hisoblanadi.
                  </p>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Jami Tushum:</span>
                      <strong className="text-white">{overview.commissionSummary.totalRevenue.toLocaleString()} so‘m</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-emerald-400 font-bold">Hamkor Ulushi (30%):</span>
                      <strong className="text-emerald-400 font-black">{overview.commissionSummary.partnerCommission.toLocaleString()} so‘m</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">NavbatBor Ulushi (70%):</span>
                      <strong className="text-slate-300">{overview.commissionSummary.navbatBorRevenue.toLocaleString()} so‘m</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">To‘lanishi kutilmoqda:</span>
                      <strong className="text-amber-400 font-bold">{overview.commissionSummary.pendingCommission.toLocaleString()} so‘m</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('commissions')}
                  className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Batafsil Hisob & Eksport</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Row: Support Issues & Operating Partner Security Boundary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Local Support Issues */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                      Mijozlar Murojaatlari (Support)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Qarshidagi muassasalarning operatsion savol va muammolari
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTicketModal(true)}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    + Yangi Murojaat
                  </button>
                </div>

                <div className="space-y-2.5">
                  {tickets.slice(0, 4).map(t => (
                    <div key={t.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {t.status === 'RESOLVED' ? 'Hal qilindi' : 'Jarayonda'}
                          </span>
                          <strong className="text-white">{t.subject}</strong>
                        </div>
                        <p className="text-[11px] text-slate-400">{t.business_name || 'Umumiy'} • {t.customer_name || 'Mijoz'}</p>
                      </div>
                      {t.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleSolveTicket(t.id)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                        >
                          Hal qilish
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Operating Partner Authority & Security Notice */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Operating Partner Huquq va Xavfsizlik Doirasi
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Operating Partner Qarshidagi to‘liq operatsion boshqaruvchidir. Founder xorijda bo‘lganda mustaqil qarorlar qabul qila oladi.
                </p>

                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px]">
                  <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl">
                    <p className="font-bold text-emerald-400 mb-1 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Ruxsat etilgan:</span>
                    </p>
                    <ul className="text-slate-300 space-y-1">
                      <li>• Bizneslarni qo‘shish va tasdiqlash</li>
                      <li>• Tarif tanlash va xizmatlar kiritish</li>
                      <li>• Xodimlar va sotuv voronkasi (CRM)</li>
                      <li>• Hisobot tuzish va Founderga jo‘natish</li>
                    </ul>
                  </div>

                  <div className="bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl">
                    <p className="font-bold text-rose-400 mb-1 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Xavfsizlik cheklovlari:</span>
                    </p>
                    <ul className="text-slate-300 space-y-1">
                      <li>• Founder hisobini o‘zgartira olmaydi</li>
                      <li>• Founder huquqini bera olmaydi</li>
                      <li>• Platformani o‘chira olmaydi</li>
                      <li>• Boshqa Operating Partner yarata olmaydi</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BUSINESS MANAGEMENT */}
        {activeTab === 'businesses' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Biznes nomi, egasi yoki telefon..."
                  value={bizSearch}
                  onChange={(e) => setBizSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={bizStatusFilter}
                  onChange={(e) => setBizStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Barcha Holatlar</option>
                  <option value="APPROVED">Tasdiqlangan (Faol)</option>
                  <option value="PENDING">Kutilmoqda</option>
                  <option value="SUSPENDED">To‘xtatilgan</option>
                </select>

                <button
                  onClick={() => setShowAddBizModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yangi Biznes Qo‘shish</span>
                </button>
              </div>
            </div>

            {/* Businesses List Table */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Muassasa Nomi</th>
                      <th className="py-3 px-4">Egasi & Telefon</th>
                      <th className="py-3 px-4">Tarif</th>
                      <th className="py-3 px-4">Holati</th>
                      <th className="py-3 px-4">Obuna muddati</th>
                      <th className="py-3 px-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {filteredBusinesses.map(biz => (
                      <tr key={biz.id} className="hover:bg-slate-750/50 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{biz.name}</div>
                          <div className="text-[11px] text-slate-400">{biz.address}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{biz.owner_name}</div>
                          <div className="text-[11px] text-slate-400">{biz.phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {biz.subscription_plan_code || 'PRO'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            biz.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            biz.status === 'SUSPENDED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {biz.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-300 font-medium">
                            {biz.subscription_expires_at ? biz.subscription_expires_at.slice(0, 10) : 'Cheksiz'}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-bold">
                            {biz.days_left ? `${biz.days_left} kun qoldi` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => setSelectedBizForTariff(biz)}
                            className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                          >
                            Tarif
                          </button>
                          {biz.status === 'APPROVED' ? (
                            <button
                              onClick={() => handleUpdateBizStatus(biz.id, 'SUSPENDED')}
                              className="px-2 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            >
                              To‘xtatish
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateBizStatus(biz.id, 'APPROVED')}
                              className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            >
                              Tasdiqlash
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CRM PIPELINE */}
        {activeTab === 'crm' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Lead nomi, egasi yoki telefon..."
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={crmStageFilter}
                  onChange={(e) => setCrmStageFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Barcha Bosqichlar</option>
                  <option value="LEAD">Lead (Yangi)</option>
                  <option value="CONTACTED">Aloqada</option>
                  <option value="DEMO">Demo</option>
                  <option value="TRIAL">Trial (Sinov)</option>
                  <option value="PAID">To‘lov Qilgan</option>
                  <option value="ACTIVE">Faol Biznes</option>
                  <option value="CHURNED">Chiqib ketgan</option>
                </select>

                <button
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yangi Lead Qo‘shish</span>
                </button>
              </div>
            </div>

            {/* Kanban Pipeline Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                { stage: 'LEAD', title: '1. Lead', badge: 'bg-slate-700 text-slate-300' },
                { stage: 'CONTACTED', title: '2. Aloqada', badge: 'bg-blue-900/60 text-blue-300 border border-blue-500/30' },
                { stage: 'DEMO', title: '3. Demo', badge: 'bg-amber-900/60 text-amber-300 border border-amber-500/30' },
                { stage: 'TRIAL', title: '4. Sinov', badge: 'bg-purple-900/60 text-purple-300 border border-purple-500/30' },
                { stage: 'PAID', title: '5. To‘lov qildi', badge: 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30' },
                { stage: 'ACTIVE', title: '6. Faol', badge: 'bg-teal-900/60 text-teal-300 border border-teal-500/30' }
              ].map(col => {
                const stageLeads = filteredLeads.filter(l => l.status === col.stage);
                return (
                  <div key={col.stage} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/50">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${col.badge}`}>
                        {col.title}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{stageLeads.length}</span>
                    </div>

                    <div className="space-y-2.5 flex-1 overflow-y-auto">
                      {stageLeads.map(lead => (
                        <div key={lead.id} className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-xl shadow-xs hover:border-slate-500 transition">
                          <div className="font-bold text-white text-xs leading-tight mb-1">{lead.business_name}</div>
                          <div className="text-[11px] text-slate-300 font-medium">{lead.owner_name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" />
                            <span>{lead.phone}</span>
                          </div>
                          {lead.telegram_username && (
                            <div className="text-[10px] text-blue-400">
                              {lead.telegram_username}
                            </div>
                          )}

                          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">{lead.business_type}</span>
                            <span className="font-bold text-emerald-400">{lead.deal_value_uzs.toLocaleString()} so‘m</span>
                          </div>

                          {/* Action Advance or Convert */}
                          <div className="mt-2.5 flex items-center gap-1.5">
                            {lead.status !== 'ACTIVE' && (
                              <button
                                onClick={() => setSelectedLeadForConvert(lead)}
                                className="w-full py-1 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/30 text-emerald-300 font-bold rounded-lg text-[10px] cursor-pointer"
                              >
                                Biznesga aylantirish
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: COMMISSIONS */}
        {activeTab === 'commissions' && commissionsData && (
          <div className="space-y-6">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Jami Haqiqiy Tushum</span>
                <div className="text-2xl font-black text-white mt-1">
                  {commissionsData.summary.totalRevenue.toLocaleString()} <span className="text-xs text-slate-400">so‘m</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Mijozlardan kelgan to‘lovlar</p>
              </div>

              <div className="bg-slate-800/90 border border-emerald-500/40 p-4 rounded-2xl">
                <span className="text-[11px] font-bold text-emerald-400 uppercase">Hamkor Komissiyasi (30%)</span>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {commissionsData.summary.partnerCommission.toLocaleString()} <span className="text-xs text-slate-400">so‘m</span>
                </div>
                <p className="text-[10px] text-emerald-300 mt-1">Operating Partner ulushi</p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase">NavbatBor Ulushi (70%)</span>
                <div className="text-2xl font-black text-slate-200 mt-1">
                  {commissionsData.summary.navbatBorRevenue.toLocaleString()} <span className="text-xs text-slate-400">so‘m</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Platforma asosiy fondi</p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Kutilayotgan Komissiya</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">
                    {commissionsData.summary.pendingCommission.toLocaleString()} <span className="text-xs text-slate-400">so‘m</span>
                  </div>
                </div>
                <button
                  onClick={handleExportCommissionsCSV}
                  className="mt-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV Eksport</span>
                </button>
              </div>
            </div>

            {/* Commissions History Table */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                  Komissiyalar Tarixi & Hisob-kitob
                </h3>
                <span className="text-xs text-slate-400">Har bir muvaffaqiyatli to‘lovdan 30%</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Sana</th>
                      <th className="py-3 px-4">Muassasa</th>
                      <th className="py-3 px-4">Tarif</th>
                      <th className="py-3 px-4">To‘lov (100%)</th>
                      <th className="py-3 px-4 text-emerald-400">Hamkor (30%)</th>
                      <th className="py-3 px-4">Holat</th>
                      <th className="py-3 px-4 text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {commissionsData.commissions.map(c => (
                      <tr key={c.id} className="hover:bg-slate-750/50 transition">
                        <td className="py-3 px-4 text-slate-400">{c.created_at?.slice(0, 10)}</td>
                        <td className="py-3 px-4 font-bold text-white">{c.business_name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                            {c.plan_code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {c.total_amount_uzs.toLocaleString()} so‘m
                        </td>
                        <td className="py-3 px-4 font-black text-emerald-400">
                          {c.partner_share_uzs.toLocaleString()} so‘m
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.payment_status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {c.payment_status === 'PAID' ? 'To‘landi' : 'Kutilmoqda'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isFounder && c.payment_status !== 'PAID' && (
                            <button
                              onClick={() => handleSettlePayout(c.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                            >
                              To‘lovni tasdiqlash
                            </button>
                          )}
                          {c.payout_notes && (
                            <span className="text-[10px] text-slate-400 italic block">{c.payout_notes}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: KPIS */}
        {activeTab === 'kpis' && overview?.kpis && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">
                Operating Partner KPI Progress Ko‘rsatkichlari
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Qarshi shahrida operatsion maqsadlarga erishish darajasi
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Yangi Bizneslar Jalb Qilish', actual: overview.kpis.newBusinesses.actual, target: overview.kpis.newBusinesses.target, unit: 'ta', pct: overview.kpis.newBusinesses.percentage },
                  { title: 'Faol Abonent Bizneslar', actual: overview.kpis.activeBusinesses.actual, target: overview.kpis.activeBusinesses.target, unit: 'ta', pct: overview.kpis.activeBusinesses.percentage },
                  { title: 'Yangi Pullik Mijozlar', actual: overview.kpis.newPayingClients.actual, target: overview.kpis.newPayingClients.target, unit: 'ta', pct: overview.kpis.newPayingClients.percentage },
                  { title: 'Oylik Tushum Maqsadi', actual: overview.kpis.monthlyRevenue.actual.toLocaleString(), target: overview.kpis.monthlyRevenue.target.toLocaleString(), unit: 'so‘m', pct: overview.kpis.monthlyRevenue.percentage },
                  { title: 'Retention (Saqlab qolish darajasi)', actual: overview.kpis.retentionRate.actual, target: overview.kpis.retentionRate.target, unit: '%', pct: overview.kpis.retentionRate.actual },
                  { title: 'Mijozlar Qoniqishi (CSAT)', actual: overview.kpis.customerSatisfaction.score, target: '5.0 ball', unit: '', pct: 96 }
                ].map((k, i) => (
                  <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">{k.title}</span>
                      <span className="font-extrabold text-emerald-400">{k.pct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, k.pct)}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Haqiqiy: <strong className="text-white">{k.actual} {k.unit}</strong></span>
                      <span>Maqsad: <strong className="text-slate-300">{k.target} {k.unit}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
              <div>
                <h3 className="text-xs font-bold uppercase text-white tracking-wider">Haftalik va Oylik Hisobotlar</h3>
                <p className="text-[11px] text-slate-400">Founder hisobotlarni Telegram va ilova orqali qabul qiladi</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenDraftReport('WEEKLY')}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Haftalik Hisobot Tuzish</span>
                </button>
                <button
                  onClick={() => handleOpenDraftReport('MONTHLY')}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Oylik Hisobot Tuzish</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map(r => (
                <div key={r.id} className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {r.period_label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      r.status === 'REVIEWED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {r.status === 'REVIEWED' ? 'Founder Tasdiqlagan' : 'Yuborilgan'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-900/60 rounded-xl">
                    <div>
                      <div className="text-[10px] text-slate-400">Yangi Bizneslar</div>
                      <div className="font-black text-white">+{r.new_businesses_count} ta</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Tushum</div>
                      <div className="font-black text-white">{r.total_revenue_uzs.toLocaleString()} so‘m</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Komissiya (30%)</div>
                      <div className="font-black text-emerald-400">{r.partner_commission_uzs.toLocaleString()} so‘m</div>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <p className="text-slate-300 font-semibold">Bajarilgan ishlar:</p>
                    <p className="text-slate-400 whitespace-pre-line text-[11px] bg-slate-900/40 p-2.5 rounded-lg">
                      {r.completed_work}
                    </p>
                  </div>

                  {r.founder_feedback && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs">
                      <p className="font-bold text-emerald-400 text-[11px]">Founder Fikri:</p>
                      <p className="text-slate-300 mt-0.5">{r.founder_feedback}</p>
                    </div>
                  )}

                  {isFounder && r.status !== 'REVIEWED' && (
                    <button
                      onClick={async () => {
                        const feedback = prompt('Founder fikri va tasdiq:', 'Hisobot qabul qilindi, faollikni davom ettiring!');
                        if (feedback) {
                          await api.reviewPartnerReport(r.id, { founder_feedback: feedback });
                          showNotification('Hisobot tasdiqlandi!');
                          loadAllData();
                        }
                      }}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Founder sifatida tasdiqlash
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: SUPPORT TICKETS */}
        {activeTab === 'support' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
              <div>
                <h3 className="text-xs font-bold uppercase text-white tracking-wider">Mijozlar Murojaatlari (Support)</h3>
                <p className="text-[11px] text-slate-400">Qarshidagi muassasalarning murojaatlarini tezkor hal etish</p>
              </div>
              <button
                onClick={() => setShowTicketModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Yangi Murojaat</span>
              </button>
            </div>

            <div className="space-y-3">
              {filteredTickets.map(t => (
                <div key={t.id} className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === 'HIGH' || t.priority === 'URGENT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {t.priority}
                      </span>
                      <strong className="text-white text-sm">{t.subject}</strong>
                    </div>
                    <p className="text-slate-300">{t.description}</p>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
                      <span>🏢 {t.business_name || 'Muassasa'}</span>
                      <span>👤 {t.customer_name} ({t.customer_phone})</span>
                      <span>📅 {t.created_at?.slice(0, 10)}</span>
                    </div>
                    {t.resolution_notes && (
                      <p className="text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded-lg mt-1">
                        ✓ Hal qilindi: {t.resolution_notes}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {t.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleSolveTicket(t.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        Hal etildi deb belgilash
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
              <h3 className="text-xs font-bold uppercase text-white tracking-wider mb-1">
                Tizim Faoliyati & Xavfsizlik Audit Jurnali
              </h3>
              <p className="text-xs text-slate-400">
                Har bir muhim o‘zgarish: Kim, nima qildi, qachon, oldingi va yangi qiymat to‘liq qayd etiladi.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Vaqt</th>
                      <th className="py-3 px-4">Mas’ul Shaxs</th>
                      <th className="py-3 px-4">Amal</th>
                      <th className="py-3 px-4">Obyekt</th>
                      <th className="py-3 px-4">Tafsilot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-mono text-[11px]">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-750/50 transition">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{log.created_at?.slice(0, 19)}</td>
                        <td className="py-3 px-4 text-slate-200">
                          {log.user_name || log.user_email || 'Tizim'} 
                          {log.user_role && <span className="text-[10px] text-emerald-400 block font-sans">({log.user_role})</span>}
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-300">{log.action}</td>
                        <td className="py-3 px-4 text-slate-300">{log.target_name || log.target_type}</td>
                        <td className="py-3 px-4 text-slate-400 font-sans">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD BUSINESS */}
      {showAddBizModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full text-xs text-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">Yangi Biznes Qo‘shish (Qarshi)</h3>
              <button onClick={() => setShowAddBizModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBusiness} className="space-y-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Muassasa Nomi</label>
                <input
                  type="text"
                  required
                  value={newBizForm.name}
                  onChange={e => setNewBizForm({ ...newBizForm, name: e.target.value })}
                  placeholder="Masalan: Nasaf Go‘zallik Saloni"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Faoliyat Turi</label>
                  <select
                    value={newBizForm.category_id}
                    onChange={e => setNewBizForm({ ...newBizForm, category_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="cat-barber">Sartaroshxona</option>
                    <option value="cat-beauty">Go‘zallik saloni</option>
                    <option value="cat-stomatology">Stomatologiya</option>
                    <option value="cat-medicine">Tibbiy klinika</option>
                    <option value="cat-auto">Avtoservis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tarif Rejasi</label>
                  <select
                    value={newBizForm.subscription_plan_code}
                    onChange={e => setNewBizForm({ ...newBizForm, subscription_plan_code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="START">START (149 000 so‘m)</option>
                    <option value="PRO">PRO (299 000 so‘m)</option>
                    <option value="BUSINESS">BUSINESS (599 000 so‘m)</option>
                    <option value="FREE">FREE (0 so‘m Sinov)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Manzili (Qarshi shahri)</label>
                <input
                  type="text"
                  required
                  value={newBizForm.address}
                  onChange={e => setNewBizForm({ ...newBizForm, address: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Muassasa Telefoni</label>
                  <input
                    type="text"
                    required
                    value={newBizForm.phone}
                    onChange={e => setNewBizForm({ ...newBizForm, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Egasi (F.I.SH)</label>
                  <input
                    type="text"
                    required
                    value={newBizForm.owner_name}
                    onChange={e => setNewBizForm({ ...newBizForm, owner_name: e.target.value })}
                    placeholder="Alisher Zokirov"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Egasi Emaili (Login uchun)</label>
                  <input
                    type="email"
                    required
                    value={newBizForm.owner_email}
                    onChange={e => setNewBizForm({ ...newBizForm, owner_email: e.target.value })}
                    placeholder="egasi@navbatbor.uz"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Boshlang‘ich Parol</label>
                  <input
                    type="text"
                    required
                    value={newBizForm.owner_password}
                    onChange={e => setNewBizForm({ ...newBizForm, owner_password: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Biznesni Ro‘yxatdan O‘tkazish va Tasdiqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD LEAD (CRM) */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full text-xs text-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">Yangi Lead Qo‘shish (CRM)</h3>
              <button onClick={() => setShowAddLeadModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Biznes Nomi</label>
                <input
                  type="text"
                  required
                  value={newLeadForm.business_name}
                  onChange={e => setNewLeadForm({ ...newLeadForm, business_name: e.target.value })}
                  placeholder="Masalan: Avto Tuning Qarshi"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Egasi</label>
                  <input
                    type="text"
                    required
                    value={newLeadForm.owner_name}
                    onChange={e => setNewLeadForm({ ...newLeadForm, owner_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Telefoni</label>
                  <input
                    type="text"
                    required
                    value={newLeadForm.phone}
                    onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Telegram</label>
                  <input
                    type="text"
                    value={newLeadForm.telegram_username}
                    onChange={e => setNewLeadForm({ ...newLeadForm, telegram_username: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Faoliyat Turi</label>
                  <input
                    type="text"
                    value={newLeadForm.business_type}
                    onChange={e => setNewLeadForm({ ...newLeadForm, business_type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Manzili</label>
                <input
                  type="text"
                  required
                  value={newLeadForm.address}
                  onChange={e => setNewLeadForm({ ...newLeadForm, address: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Taxminiy Bitim Qiymati</label>
                  <input
                    type="number"
                    value={newLeadForm.deal_value_uzs}
                    onChange={e => setNewLeadForm({ ...newLeadForm, deal_value_uzs: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Dastlabki Bosqich</label>
                  <select
                    value={newLeadForm.status}
                    onChange={e => setNewLeadForm({ ...newLeadForm, status: e.target.value as CRMLeadStage })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="LEAD">Lead (Yangi)</option>
                    <option value="CONTACTED">Aloqada</option>
                    <option value="DEMO">Demo rejalashtirildi</option>
                    <option value="TRIAL">Trial (Sinov)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Izoh / Suhbat Xulosasi</label>
                <textarea
                  rows={2}
                  value={newLeadForm.notes}
                  onChange={e => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  placeholder="Mijoz nimaga qiziqmoqda..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Leadni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONVERT LEAD TO BUSINESS */}
      {selectedLeadForConvert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 max-w-sm w-full text-xs text-slate-200">
            <h3 className="text-sm font-black text-white mb-2">Leadni NavbatBor Biznesga Aylantirish</h3>
            <p className="text-slate-400 mb-4">
              <strong className="text-white">{selectedLeadForConvert.business_name}</strong> uchun avtomatik biznes profili va egasi hisobi yaratiladi.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Tarif tanlang</label>
                <select
                  id="convert-plan-select"
                  defaultValue="START"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="START">START (149 000 so‘m)</option>
                  <option value="PRO">PRO (299 000 so‘m)</option>
                  <option value="BUSINESS">BUSINESS (599 000 so‘m)</option>
                  <option value="FREE">FREE (Sinov)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setSelectedLeadForConvert(null)}
                  className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={() => {
                    const sel = (document.getElementById('convert-plan-select') as HTMLSelectElement)?.value || 'START';
                    handleConvertLead(selectedLeadForConvert.id, sel);
                  }}
                  className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
                >
                  Tasdiqlash & Aylantirish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT REPORT */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full text-xs text-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">Founder’ga Hisobot Yuborish</h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="space-y-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Davr Nomi</label>
                <input
                  type="text"
                  required
                  value={reportForm.period_label}
                  onChange={e => setReportForm({ ...reportForm, period_label: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">Yangi Bizneslar</span>
                  <strong className="text-white text-sm">{reportForm.new_businesses_count} ta</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Jami Tushum</span>
                  <strong className="text-white text-sm">{reportForm.total_revenue_uzs.toLocaleString()} so‘m</strong>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 block">Hamkor Ulushi</span>
                  <strong className="text-emerald-400 text-sm">{reportForm.partner_commission_uzs.toLocaleString()} so‘m</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Bajarilgan Ishlar</label>
                <textarea
                  rows={3}
                  required
                  value={reportForm.completed_work}
                  onChange={e => setReportForm({ ...reportForm, completed_work: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Muammolar / To‘siqlar</label>
                <textarea
                  rows={2}
                  value={reportForm.issues_summary}
                  onChange={e => setReportForm({ ...reportForm, issues_summary: e.target.value })}
                  placeholder="Agar muammo bo‘lmasa bo‘sh qoldiring"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Keyingi Hafta Rejasi</label>
                <textarea
                  rows={2}
                  required
                  value={reportForm.next_week_plan}
                  onChange={e => setReportForm({ ...reportForm, next_week_plan: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Hisobotni Founder’ga & Telegramga Yuborish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD TICKET */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full text-xs text-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">Yangi Support Murojaati</h3>
              <button onClick={() => setShowTicketModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Mavzu</label>
                <input
                  type="text"
                  required
                  value={newTicketForm.subject}
                  onChange={e => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                  placeholder="Masalan: QR-kod chop etish"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Muassasa Nomi</label>
                  <input
                    type="text"
                    value={newTicketForm.business_name}
                    onChange={e => setNewTicketForm({ ...newTicketForm, business_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Muhimlik Darajasi</label>
                  <select
                    value={newTicketForm.priority}
                    onChange={e => setNewTicketForm({ ...newTicketForm, priority: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="LOW">Past</option>
                    <option value="MEDIUM">O‘rta</option>
                    <option value="HIGH">Yuqori</option>
                    <option value="URGENT">Zudlik bilan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Muammo Tafsiloti</label>
                <textarea
                  rows={3}
                  required
                  value={newTicketForm.description}
                  onChange={e => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                  placeholder="Mijoz yoki tadbirkor nimadan shikoyat qilmoqda..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Murojaatni Ro‘yxatga Olish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
