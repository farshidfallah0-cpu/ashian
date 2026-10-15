import { sql, type SQL } from 'drizzle-orm';

/**
 * نقطه‌ی WGS84 برای نوشتن در ستون geometry(Point, 4326).
 * رشته‌ی WKT ساده SRID صفر می‌دهد و با ستون ناسازگار است؛ پس همیشه از این تابع استفاده کنید.
 */
export const point = (lng: number, lat: number): SQL =>
  sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

/** استخراج مختصات برای select: .select({ lng: lngOf(col), lat: latOf(col) }) */
export const lngOf = (column: unknown): SQL<number> => sql<number>`ST_X(${column})`;
export const latOf = (column: unknown): SQL<number> => sql<number>`ST_Y(${column})`;

/** فاصله‌ی دایره‌ای بر حسب متر بین دو ستون/نقطه (geography) */
export const distanceMeters = (a: unknown, b: unknown): SQL<number> =>
  sql<number>`ST_Distance(${a}::geography, ${b}::geography)`;
