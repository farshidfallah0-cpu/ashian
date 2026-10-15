import { AGENT_LANGUAGES, DEAL_TYPES, PROPERTY_TYPES, type DealType, type PropertyType } from '@ashian/shared';
import { BadRequestException, Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { parsePagination, UuidPipe } from '../common/pipes.js';
import { AgenciesService } from './agencies.service.js';
import { AgentsService } from './agents.service.js';

const CACHE = 'public, max-age=30, s-maxage=120, stale-while-revalidate=300';

const oneOf = <T extends string>(value: unknown, list: readonly T[], name: string): T | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !(list as readonly string[]).includes(value)) {
    throw new BadRequestException(`${name} نامعتبر است`);
  }
  return value as T;
};

const text = (value: unknown, max = 60) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

@ApiTags('agents')
@Public()
@Controller('agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Get()
  @Header('Cache-Control', CACHE)
  @ApiOperation({ summary: 'جستجو و فهرست مشاوران تأییدشده؛ مشاور برتر اول' })
  list(@Query() query: Record<string, unknown>) {
    const pipe = new UuidPipe();
    return this.service.list({
      q: text(query.q),
      communityId: typeof query.communityId === 'string' ? pipe.transform(query.communityId) : undefined,
      agencyId: typeof query.agencyId === 'string' ? pipe.transform(query.agencyId) : undefined,
      dealType: oneOf<DealType>(query.dealType, DEAL_TYPES, 'نوع معامله'),
      propertyType: oneOf<PropertyType>(query.propertyType, PROPERTY_TYPES, 'نوع ملک'),
      language: oneOf(query.language, AGENT_LANGUAGES, 'زبان'),
      sort: oneOf(query.sort, ['top', 'listings', 'rating'] as const, 'مرتب‌سازی'),
      ...parsePagination(query),
    });
  }

  @Get(':id')
  @Header('Cache-Control', CACHE)
  @ApiOperation({ summary: 'پروفایل مشاور' })
  get(@Param('id', new UuidPipe()) id: string) {
    return this.service.get(id);
  }
}

@ApiTags('agencies')
@Public()
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly service: AgenciesService) {}

  @Get()
  @Header('Cache-Control', CACHE)
  @ApiOperation({ summary: 'فهرست آژانس‌های تأییدشده' })
  list(@Query() query: Record<string, unknown>) {
    return this.service.list({ q: text(query.q), ...parsePagination(query) });
  }

  @Get(':slug')
  @Header('Cache-Control', CACHE)
  @ApiOperation({ summary: 'پروفایل آژانس با تیم' })
  get(@Param('slug') slug: string) {
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) throw new BadRequestException('شناسه‌ی آژانس نامعتبر است');
    return this.service.get(slug);
  }
}