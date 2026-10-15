import {
  mapQuerySchema,
  searchQuerySchema,
  suggestQuerySchema,
  type MapQuery,
  type SearchQuery,
  type SuggestQuery,
} from '@ashian/shared';
import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SearchApiService } from './search.service.js';

/** پاسخ جستجو برای همه‌ی بازدیدکننده‌ها یکی است؛ CDN چند ثانیه نگه می‌دارد */
const PUBLIC_SHORT_CACHE = 'public, max-age=0, s-maxage=15, stale-while-revalidate=30';

@ApiTags('search')
@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchApiService) {}

  @Get('listings')
  @Header('Cache-Control', PUBLIC_SHORT_CACHE)
  @ApiOperation({
    summary: 'جستجوی آگهی‌ها با فیلتر، facet، مرتب‌سازی و چینش منصفانه',
    description:
      'همه‌ی فیلترها پارامتر URL هستند (dealType, propertyType, location, priceMin, priceMax, bedroomsMin, ' +
      'bedroomsMax, bathroomsMin, areaMin, areaMax, furnishing, amenities, verified, cheques, parkingMin, ' +
      'postedWithin, agentId, q, bbox). sort: relevance | newest | price_asc | price_desc | area_desc. ' +
      'verifiedFirst=1 «تأییدشده‌ها اول».',
  })
  listings(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery) {
    return this.service.searchListings(query);
  }

  @Get('map')
  @Header('Cache-Control', PUBLIC_SHORT_CACHE)
  @ApiOperation({
    summary: 'پین‌ها و خوشه‌های آگهی داخل محدوده‌ی نقشه (bbox=west,south,east,north)',
  })
  map(@Query(new ZodValidationPipe(mapQuerySchema)) query: MapQuery) {
    return this.service.map(query);
  }

  @Get('suggest')
  @Header('Cache-Control', 'public, max-age=30, s-maxage=60')
  @ApiOperation({ summary: 'پیشنهاد خودکار: محله، برج، مشاور، آژانس و کد آگهی' })
  suggest(@Query(new ZodValidationPipe(suggestQuerySchema)) query: SuggestQuery) {
    return this.service.suggest(query.q, query.limit);
  }
}
