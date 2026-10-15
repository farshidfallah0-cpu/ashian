import type { DealType, LeadStatus, LeadType, PropertyType, VerificationStatus } from '../domain.js';

/** شکل پاسخ‌های پنل مشاور و آژانس و صفحه‌های عمومی (فقط تایپ) */

export interface AgentSummary {
  id: string;
  name: string;
  avatarKey: string | null;
  bio: string | null;
  languages: string[];
  areas: Array<{ id: string; slug: string; nameFa: string }>;
  agency: { id: string; name: string; slug: string; logoKey: string | null } | null;
  rating: number | null;
  reviewCount: number;
  avgResponseMinutes: number | null;
  isTopAgent: boolean;
  isVerified: boolean;
  activeListingCount: number;
}

export interface AgentProfileDto extends AgentSummary {
  joinedAt: string;
  deals: Array<{ dealType: DealType; count: number }>;
  propertyTypes: Array<{ propertyType: PropertyType; count: number }>;
}

export interface AgencySummary {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  logoKey: string | null;
  description: string | null;
  licenseNumber: string | null;
  isVerified: boolean;
  agentCount: number;
  activeListingCount: number;
}

export interface AgencyProfileDto extends AgencySummary {
  team: AgentSummary[];
  areas: Array<{ slug: string; nameFa: string; count: number }>;
}

/** هویت مشاور/مدیر برای پنل (GET /v1/agent/me) */
export interface PanelMe {
  agent: {
    id: string;
    brn: string | null;
    bio: string | null;
    languages: string[];
    areaIds: string[];
    whatsapp: string | null;
    verificationStatus: VerificationStatus;
    isTopAgent: boolean;
    agency: { id: string; name: string; slug: string } | null;
  } | null;
  /** آژانسی که کاربر مدیر آن است */
  managedAgency: { id: string; name: string; slug: string; verificationStatus: VerificationStatus } | null;
}

export interface DashboardSeriesPoint {
  day: string;
  views: number;
  leads: number;
}

export interface Dashboard {
  days: number;
  kpis: {
    activeListings: number;
    views: number;
    uniqueViews: number;
    leads: number;
    /** سرنخ ÷ بازدید یکتا (درصد)؛ null اگر بازدیدی نیست */
    leadRate: number | null;
    newLeads: number;
    avgResponseMinutes: number | null;
  };
  series: DashboardSeriesPoint[];
  leadsByType: Record<LeadType, number>;
  topListings: Array<{ publicId: string; title: string; views: number; leads: number }>;
}

export interface AgentDashboard extends Dashboard {
  badge: { isTop: boolean; gaps: string[] };
}

export interface TeamMemberStats {
  agentId: string;
  name: string;
  isVerified: boolean;
  isTopAgent: boolean;
  activeListings: number;
  views: number;
  leads: number;
  avgResponseMinutes: number | null;
}

export interface AgencyOverview {
  agency: AgencySummary & { verificationStatus: VerificationStatus };
  dashboard: Dashboard;
  team: TeamMemberStats[];
}

export interface InboxLead {
  id: string;
  type: LeadType;
  status: LeadStatus;
  name: string | null;
  phone: string | null;
  message: string | null;
  createdAt: string;
  firstResponseAt: string | null;
  listing: { publicId: string; title: string; code: number } | null;
  agentName: string | null;
}