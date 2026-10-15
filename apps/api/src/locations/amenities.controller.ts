import type { DbClient } from '@ashian/db';
import { asc, schema } from '@ashian/db';
import type { Cache } from '@ashian/infra';
import { Controller, Get, Header, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { CACHE, DB } from '../infra/tokens.js';

@ApiTags('amenities')
@Public()
@Controller('amenities')
export class AmenitiesController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(CACHE) private readonly cache: Cache,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  @ApiOperation({ summary: 'فهرست امکانات (برای فیلتر و فرم ثبت آگهی)' })
  list() {
    return this.cache.wrap('amenities:all', 3600, () =>
      this.db.replica
        .select({
          id: schema.amenities.id,
          slug: schema.amenities.slug,
          nameFa: schema.amenities.nameFa,
          category: schema.amenities.category,
          icon: schema.amenities.icon,
        })
        .from(schema.amenities)
        .orderBy(asc(schema.amenities.sortOrder)),
    );
  }
}
