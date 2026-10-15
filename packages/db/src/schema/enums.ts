import {
  ALERT_FREQUENCIES,
  AMENITY_CATEGORIES,
  DEAL_TYPES,
  FURNISHING_TYPES,
  LEAD_STATUSES,
  LEAD_TYPES,
  LISTING_STATUSES,
  LISTING_TIERS,
  LOCATION_TYPES,
  MEDIA_KINDS,
  MEDIA_STATUSES,
  PROPERTY_TYPES,
  REPORT_REASONS,
  REPORT_STATUSES,
  USER_ROLES,
  USER_STATUSES,
  VERIFICATION_STATUSES,
} from '@ashian/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

/** مقدار هر enum از packages/shared می‌آید تا دیتابیس و API هیچ‌وقت ناهم‌خوان نشوند */
export const userRole = pgEnum('user_role', USER_ROLES);
export const userStatus = pgEnum('user_status', USER_STATUSES);
export const verificationStatus = pgEnum('verification_status', VERIFICATION_STATUSES);
export const locationType = pgEnum('location_type', LOCATION_TYPES);
export const dealType = pgEnum('deal_type', DEAL_TYPES);
export const propertyType = pgEnum('property_type', PROPERTY_TYPES);
export const furnishing = pgEnum('furnishing', FURNISHING_TYPES);
export const listingStatus = pgEnum('listing_status', LISTING_STATUSES);
export const listingTier = pgEnum('listing_tier', LISTING_TIERS);
export const mediaKind = pgEnum('media_kind', MEDIA_KINDS);
export const mediaStatus = pgEnum('media_status', MEDIA_STATUSES);
export const leadType = pgEnum('lead_type', LEAD_TYPES);
export const leadStatus = pgEnum('lead_status', LEAD_STATUSES);
export const alertFrequency = pgEnum('alert_frequency', ALERT_FREQUENCIES);
export const reportReason = pgEnum('report_reason', REPORT_REASONS);
export const reportStatus = pgEnum('report_status', REPORT_STATUSES);
export const amenityCategory = pgEnum('amenity_category', AMENITY_CATEGORIES);
