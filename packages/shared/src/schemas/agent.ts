import { z } from 'zod';
import { LEAD_STATUSES } from '../domain.js';
import { persianText, phoneSchema } from './common.js';

/** زبان‌هایی که مشاور می‌تواند اعلام کند (کد ISO) */
export const AGENT_LANGUAGES = ['fa', 'en', 'ar', 'ru', 'hi', 'ur', 'tr'] as const;
export const LANGUAGE_LABELS: Record<(typeof AGENT_LANGUAGES)[number], string> = {
  fa: 'فارسی',
  en: 'انگلیسی',
  ar: 'عربی',
  ru: 'روسی',
  hi: 'هندی',
  ur: 'اردو',
  tr: 'ترکی',
};

const agentFields = {
  /** شماره‌ی کارت مشاور (BRN) */
  brn: z
    .string()
    .trim()
    .regex(/^\d{4,12}$/, 'شماره‌ی کارت مشاور (BRN) فقط رقم و ۴ تا ۱۲ رقمی است'),
  bio: persianText(0, 1200),
  languages: z.array(z.enum(AGENT_LANGUAGES)).min(1, 'حداقل یک زبان انتخاب کنید').max(7),
  areaIds: z.array(z.uuid()).max(12, 'حداکثر ۱۲ محله'),
  whatsapp: phoneSchema.nullable(),
};

export const joinAgentSchema = z.object({
  ...agentFields,
  bio: agentFields.bio.default(''),
  areaIds: agentFields.areaIds.default([]),
  whatsapp: agentFields.whatsapp.default(null),
  /** پیوستن به یک آژانس موجود (اختیاری؛ مدیر آژانس باید تأیید کند) */
  agencySlug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});
export type JoinAgentInput = z.infer<typeof joinAgentSchema>;

export const updateAgentProfileSchema = z
  .object(agentFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'چیزی برای ویرایش نیست');
export type UpdateAgentProfileInput = z.infer<typeof updateAgentProfileSchema>;

export const createAgencySchema = z.object({
  name: persianText(2, 80),
  nameEn: z.string().trim().max(80).nullable().default(null),
  description: persianText(0, 1500).default(''),
  /** شماره‌ی مجوز شرکت (ORN) */
  licenseNumber: z.string().trim().max(40).nullable().default(null),
});
export type CreateAgencyInput = z.infer<typeof createAgencySchema>;

export const updateAgencySchema = z
  .object({
    name: persianText(2, 80),
    nameEn: z.string().trim().max(80).nullable(),
    description: persianText(0, 1500),
    licenseNumber: z.string().trim().max(40).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'چیزی برای ویرایش نیست');
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;

export const addTeamMemberSchema = z.object({ phone: phoneSchema });
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;

export const leadStatusSchema = z.object({ status: z.enum(LEAD_STATUSES) });
export type LeadStatusInput = z.infer<typeof leadStatusSchema>;