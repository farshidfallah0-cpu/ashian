import { LOCATION_TYPES, type LocationType } from '@ashian/shared';
import { BadRequestException, Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { UuidPipe } from '../common/pipes.js';
import { LocationsService } from './locations.service.js';

@ApiTags('locations')
@Public()
@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'فهرست مکان‌ها (فیلتر با type و parentId)' })
  list(@Query('type') type?: string, @Query('parentId') parentId?: string) {
    if (type && !(LOCATION_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException('نوع مکان نامعتبر است');
    }
    if (parentId) new UuidPipe().transform(parentId);
    return this.service.list({ type: type as LocationType | undefined, parentId });
  }

  @Get('tree')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'درخت کامل مکان‌ها' })
  tree() {
    return this.service.tree();
  }

  @Get(':community')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'یک محله با slug' })
  community(@Param('community') community: string) {
    return this.service.bySlug(community);
  }

  @Get(':community/:tower')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'یک برج داخل محله' })
  tower(@Param('community') community: string, @Param('tower') tower: string) {
    return this.service.bySlug(community, tower);
  }
}
