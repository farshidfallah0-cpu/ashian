import type { Cache } from '@ashian/infra';
import { SearchService, type SearchEngine } from '@ashian/search';
import type { MapQuery, SearchQuery } from '@ashian/shared';
import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CACHE, SEARCH_ENGINE } from '../infra/tokens.js';

/**
 * پوسته‌ی نازک Nest روی SearchService (که در packages/search است و مستقل از Nest تست می‌شود).
 * خطای موتور جستجو به ۵۰۳ تبدیل می‌شود، نه ۵۰۰: مشکل زیرساخت است، نه باگ درخواست.
 */
@Injectable()
export class SearchApiService {
  private readonly logger = new Logger('Search');
  private readonly service: SearchService;

  constructor(@Inject(SEARCH_ENGINE) engine: SearchEngine, @Inject(CACHE) cache: Cache) {
    this.service = new SearchService({ engine, cache });
  }

  private async guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      this.logger.error(`${operation} ناموفق: ${String(error)}`);
      throw new ServiceUnavailableException('جستجو موقتاً در دسترس نیست');
    }
  }

  searchListings(query: SearchQuery) {
    return this.guard('searchListings', () => this.service.searchListings(query));
  }

  map(query: MapQuery) {
    return this.guard('map', () => this.service.map(query));
  }

  suggest(q: string, limit: number) {
    return this.guard('suggest', () => this.service.suggest(q, limit));
  }
}
