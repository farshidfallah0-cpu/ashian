import 'server-only';
import type {
  AgencyProfileDto,
  AgencySummary,
  AgentProfileDto,
  AgentSummary,
  SearchCard,
  SearchResponse,
} from '@ashian/shared';
import { apiFetch, apiGet, type ApiResult } from './api';

const REVALIDATE = 120;

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function getAgents(qs: string): Promise<Paged<AgentSummary> | null> {
  return apiGet<Paged<AgentSummary>>(`/v1/agents?${qs}`, { revalidate: REVALIDATE });
}

export const getAgent = (id: string): Promise<ApiResult<AgentProfileDto>> =>
  apiFetch<AgentProfileDto>(`/v1/agents/${id}`, { revalidate: REVALIDATE });

export function getAgencies(qs: string): Promise<Paged<AgencySummary> | null> {
  return apiGet<Paged<AgencySummary>>(`/v1/agencies?${qs}`, { revalidate: REVALIDATE });
}

export const getAgency = (slug: string): Promise<ApiResult<AgencyProfileDto>> =>
  apiFetch<AgencyProfileDto>(`/v1/agencies/${slug}`, { revalidate: REVALIDATE });

/** آگهی‌های فعال یک مشاور (کارت‌های جستجو) */
export async function getAgentListings(agentId: string, pageSize = 12): Promise<SearchResponse | null> {
  return apiGet<SearchResponse>(
    `/v1/search/listings?agentId=${agentId}&sort=newest&pageSize=${pageSize}&facets=0`,
    { revalidate: REVALIDATE },
  );
}

export type { SearchCard };