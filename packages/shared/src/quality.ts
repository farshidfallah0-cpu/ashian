export interface QualityInput {
  photoCount: number;
  descriptionLength: number;
  amenityCount: number;
  hasPermit: boolean;
  hasFloor?: boolean;
  isVerified?: boolean;
}

/**
 * امتیاز کیفیت آگهی (۰ تا ۱۰۰). در رتبه‌بندی جستجو استفاده می‌شود:
 * آگهی‌های بی‌کیفیت (عکس کم، اطلاعات ناقص) پایین‌تر می‌نشینند (مرحله ۴).
 */
export function computeQualityScore(input: QualityInput): number {
  let score = 20;
  score += Math.min(input.photoCount, 10) * 4; // تا ۴۰
  if (input.descriptionLength >= 400) score += 15;
  else if (input.descriptionLength >= 150) score += 10;
  else if (input.descriptionLength >= 50) score += 4;
  score += Math.min(input.amenityCount, 8); // تا ۸
  if (input.hasPermit) score += 7;
  if (input.hasFloor) score += 2;
  if (input.isVerified) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}
