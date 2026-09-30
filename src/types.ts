export type UserRole = 
  | 'FOUNDER' 
  | 'OWNER' 
  | 'ADMIN' 
  | 'OPERATING_PARTNER' 
  | 'SALES_MANAGER' 
  | 'BUSINESS_MANAGER' 
  | 'SUPPORT' 
  | 'BUSINESS_OWNER' 
  | 'STAFF' 
  | 'EMPLOYEE' 
  | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
export type BusinessStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type QueueStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'SKIPPED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  telegram_chat_id?: string;
  telegram_username?: string;
  telegram_notifications_enabled?: number;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
}

export interface City {
  id: string;
  name: string;
  region: string;
}

export interface BusinessItem {
  id: string;
  name: string;
  slug: string;
  district?: string;
  address: string;
  phone: string;
  description?: string;
  logo_url?: string;
  is_verified: number;
  is_sponsored: number;
  is_recommended?: number;
  category_name: string;
  category_slug: string;
  city_name: string;
  avg_rating: number | null;
  review_count: number;
  service_count?: number;
  is_open?: boolean;
  working_hours?: string;
  status_text?: string;
  next_available?: string;
  active_queue_count?: number;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | null;
  telegram_username?: string;
  telegram_chat_id?: string;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  price_uzs: number;
  duration_minutes: number;
  is_active: number;
}

export interface StaffMember {
  id: string;
  business_id: string;
  name: string;
  title: string;
  phone?: string;
  avatar_url?: string;
  service_ids?: string;
}

export interface BusinessHours {
  id: string;
  business_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: number;
  break_start?: string;
  break_end?: string;
}

export interface Review {
  id: string;
  business_id: string;
  booking_id: string;
  customer_id: string;
  customer_name?: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  business_id: string;
  business_name?: string;
  business_slug?: string;
  business_address?: string;
  business_phone?: string;
  service_id: string;
  service_name?: string;
  duration_minutes?: number;
  staff_id: string;
  staff_name?: string;
  staff_avatar?: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price_uzs: number;
  status: BookingStatus;
  cancel_reason?: string;
  created_at: string;
  review_id?: string;
  review_rating?: number;
}

export interface QueueEntry {
  id: string;
  business_id: string;
  business_name?: string;
  business_slug?: string;
  business_address?: string;
  service_id: string;
  service_name?: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  queue_number: string;
  status: QueueStatus;
  joined_at: string;
  peopleAhead?: number;
  estimatedWaitMinutes?: number;
}

export interface CRMCustomer {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  total_bookings: number;
  completed_visits: number;
  cancelled_count: number;
  no_show_count: number;
  total_spent_uzs: number;
  last_visit_date?: string;
  next_booking_date?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  price_uzs: number;
  max_staff: number;
  max_monthly_bookings: number;
  features_json: string;
}

export interface TelegramLog {
  id: string;
  recipient_type: string;
  recipient_id?: string;
  chat_id?: string;
  message: string;
  status: string;
  error_details?: string;
  created_at: string;
}

export interface SubscriptionTransaction {
  id: string;
  business_id: string;
  business_name?: string;
  plan_code: string;
  amount_uzs: number;
  duration_days: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export interface BusinessSubscriptionInfo {
  business: {
    id: string;
    name: string;
    subscription_plan_code: string;
    subscription_expires_at: string;
    subscription_status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
    telegram_chat_id?: string;
    days_left: number;
  };
  plan: SubscriptionPlan;
  daysLeft: number;
  transactions: SubscriptionTransaction[];
}

export interface AdminOverviewStats {
  usersCount: number;
  bizCount: number;
  activeBizCount: number;
  pendingBizCount: number;
  bookingsCount: number;
  todayBookingsCount: number;
  revenueTotal: number;
  monthlyRevenue: number;
  queueTotal: number;
  reviewsCount: number;
  avgRating: string;
  expiringSoonCount: number;
  expiredCount: number;
  telegramLogsCount: number;
}

export interface AdminChartsData {
  dailyBookings: Array<{ date: string; count: number; revenue: number }>;
  categoryStats: Array<{ name: string; bookings_count: number; total_volume: number }>;
  cityStats: Array<{ name: string; businesses_count: number; bookings_count: number }>;
}

export interface SystemHealthData {
  status: string;
  uptimeSeconds: number;
  nodeVersion: string;
  memoryUsageMB: number;
  tableCounts: Record<string, number>;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

export interface FavoriteBusiness extends BusinessItem {
  saved_at: string;
}

export interface AdAnalytics {
  is_sponsored: boolean;
  active_promo: any | null;
  impressions: number;
  clicks: number;
  bookings_count: number;
  ctr_percent: string;
}

export interface PublicQueueBoard {
  business: {
    id: string;
    name: string;
    slug: string;
    district?: string;
    address: string;
    phone: string;
  };
  serving: Array<{
    id: string;
    queue_number: string;
    customer_name: string;
    service_name: string;
    called_at?: string;
  }>;
  called: Array<{
    id: string;
    queue_number: string;
    customer_name: string;
    service_name: string;
  }>;
  waiting: Array<{
    id: string;
    queue_number: string;
    customer_name: string;
    service_name: string;
    joined_at: string;
  }>;
  totalWaiting: number;
  lastUpdated: string;
}

// ==========================================
// OPERATING PARTNER & CRM & COMMISSION TYPES
// ==========================================

export type CRMLeadStage = 
  | 'LEAD' 
  | 'CONTACTED' 
  | 'DEMO' 
  | 'TRIAL' 
  | 'PAID' 
  | 'ACTIVE' 
  | 'CHURNED';

export interface CRMLead {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  telegram_username?: string;
  address: string;
  business_type: string;
  assigned_partner_id?: string;
  assigned_partner_name?: string;
  status: CRMLeadStage;
  deal_value_uzs: number;
  last_contact_date?: string;
  next_contact_date?: string;
  notes?: string;
  converted_business_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerCommission {
  id: string;
  transaction_id?: string;
  business_id: string;
  business_name: string;
  partner_id: string;
  partner_name: string;
  plan_code: string;
  total_amount_uzs: number;
  partner_rate: number; // e.g. 0.30
  partner_share_uzs: number; // 30%
  navbatbor_share_uzs: number; // 70%
  payment_status: 'PENDING' | 'PAID' | 'CANCELLED';
  paid_at?: string;
  payout_notes?: string;
  created_at: string;
}

export interface CommissionSummary {
  totalRevenue: number;
  partnerCommission: number;
  navbatBorRevenue: number;
  paidCommission: number;
  pendingCommission: number;
  partnerRatePercent: number;
  commissionsCount: number;
}

export interface OperatingPartnerKPI {
  newBusinesses: { actual: number; target: number; percentage: number };
  activeBusinesses: { actual: number; target: number; percentage: number };
  newPayingClients: { actual: number; target: number; percentage: number };
  monthlyRevenue: { actual: number; target: number; percentage: number };
  retentionRate: { actual: number; target: number; percentage: number }; // e.g. 92%
  churnRate: { actual: number; target: number; percentage: number }; // e.g. 5%
  customerSatisfaction: { actual: number; target: number; score: string }; // e.g. 4.8 / 5.0 (96%)
  supportResolutionTime: { actualMinutes: number; targetMinutes: number; text: string }; // e.g. 35 mins
}

export interface PartnerReport {
  id: string;
  partner_id: string;
  partner_name: string;
  report_type: 'WEEKLY' | 'MONTHLY';
  period_label: string;
  period_start: string;
  period_end: string;
  new_businesses_count: number;
  total_businesses_count: number;
  total_revenue_uzs: number;
  partner_commission_uzs: number;
  new_customers_count: number;
  issues_summary: string;
  completed_work: string;
  next_week_plan: string;
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED';
  founder_feedback?: string;
  telegram_sent: number;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  business_id?: string;
  business_name?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assigned_to_id?: string;
  assigned_to_name?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
}

export interface OperatingAuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  target_type: string;
  target_id?: string;
  target_name?: string;
  details?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface OperatingPartnerOverview {
  todayRevenue: number;
  monthlyRevenue: number;
  partnerMonthlyCommission: number;
  newBusinessesThisMonth: number;
  activeBusinessesCount: number;
  totalBusinessesCount: number;
  newCustomersThisMonth: number;
  totalQueueCount: number;
  cancelledQueueCount: number;
  activeTariffsBreakdown: {
    FREE: number;
    START: number;
    PRO: number;
    BUSINESS: number;
  };
  crmPipelineCounts: Record<CRMLeadStage, number>;
  supportStats: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
  };
  commissionSummary: CommissionSummary;
  kpis: OperatingPartnerKPI;
  recentActivities: OperatingAuditLog[];
  dailyTrend: Array<{ date: string; bookings: number; revenue: number }>;
}

