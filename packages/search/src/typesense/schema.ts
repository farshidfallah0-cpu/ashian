/**
 * اسکیمای collectionها. هر تغییری در فیلدها باید SCHEMA_VERSION را بالا ببرد:
 * اسم collection شامل نسخه است و `search:reindex` ایندکس نسخه‌ی جدید را می‌سازد و alias را جابه‌جا می‌کند
 * (بدون قطعی). Typesense تغییر نوع فیلد را درجا نمی‌پذیرد، پس همیشه ایندکس تازه می‌سازیم.
 */
export const SCHEMA_VERSION = 1;

export const LISTINGS_ALIAS = 'listings';
export const SUGGESTIONS_ALIAS = 'suggestions';

export const collectionName = (alias: string, suffix: string | number = Date.now()) =>
  `${alias}_v${SCHEMA_VERSION}_${suffix}`;

interface Field {
  name: string;
  type: string;
  facet?: boolean;
  optional?: boolean;
  index?: boolean;
  sort?: boolean;
  locale?: string;
}

export interface CollectionSchema {
  name: string;
  fields: Field[];
  /** ترتیب پیش‌فرض وقتی sort_by داده نشود */
  default_sorting_field?: string;
  token_separators?: string[];
}

export function listingsSchema(name: string): CollectionSchema {
  return {
    name,
    fields: [
      { name: 'code', type: 'int32' },
      { name: 'dealType', type: 'string', facet: true },
      { name: 'propertyType', type: 'string', facet: true },
      { name: 'furnishing', type: 'string', facet: true },
      { name: 'tier', type: 'string' },
      { name: 'verified', type: 'int32', facet: true },
      { name: 'price', type: 'int64' },
      { name: 'pricePerSqft', type: 'int32' },
      { name: 'bedrooms', type: 'int32', facet: true },
      { name: 'bathrooms', type: 'int32' },
      { name: 'areaSqft', type: 'int32' },
      { name: 'parkingSpaces', type: 'int32' },
      { name: 'photoCount', type: 'int32' },
      { name: 'rentCheques', type: 'int32[]', facet: true },
      { name: 'amenities', type: 'string[]', facet: true },
      { name: 'locationPaths', type: 'string[]' },
      { name: 'communitySlug', type: 'string', facet: true },
      { name: 'agentId', type: 'string' },
      { name: 'qualityScore', type: 'int32' },
      { name: 'rankScore', type: 'int32' },
      { name: 'publishedAt', type: 'int64' },
      { name: 'expiresAt', type: 'int64' },
      { name: 'location', type: 'geopoint' },
      { name: 'geohash3', type: 'string', facet: true },
      { name: 'geohash4', type: 'string', facet: true },
      { name: 'geohash5', type: 'string', facet: true },
      { name: 'geohash6', type: 'string', facet: true },
      // متن‌ها قبلاً با normalizeForSearch یکسان شده‌اند؛ تایپس‌نس فقط توکن‌بندی می‌کند
      { name: 'searchPlace', type: 'string' },
      { name: 'searchTitle', type: 'string' },
      { name: 'searchAgent', type: 'string', optional: true },
      { name: 'searchExtra', type: 'string', optional: true },
      // کارت آماده‌ی نمایش؛ فقط ذخیره می‌شود، ایندکس نمی‌شود
      { name: 'card', type: 'string', index: false, optional: true },
    ],
  };
}

export function suggestionsSchema(name: string): CollectionSchema {
  return {
    name,
    fields: [
      { name: 'kind', type: 'string' },
      { name: 'ref', type: 'string', index: false },
      { name: 'label', type: 'string', index: false },
      { name: 'sublabel', type: 'string', index: false, optional: true },
      { name: 'searchText', type: 'string' },
      { name: 'listingCount', type: 'int32' },
      { name: 'kindWeight', type: 'int32' },
    ],
  };
}
