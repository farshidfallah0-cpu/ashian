import { Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { parsePagination, PublicIdPipe } from '../common/pipes.js';
import { FavoritesService } from './favorites.service.js';

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'علاقه‌مندی‌ها (کارت آگهی)' })
  list(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    const { page, pageSize } = parsePagination(query);
    return this.service.list(user!.id, page, pageSize);
  }

  @Get('ids')
  @ApiOperation({ summary: 'شناسه‌ی آگهی‌های علاقه‌مند (برای نمایش قلب)' })
  async ids(@CurrentUser({ required: true }) user: AuthUser | undefined) {
    return { ids: await this.service.ids(user!.id) };
  }

  @Put(':publicId')
  @HttpCode(204)
  @ApiOperation({ summary: 'افزودن به علاقه‌مندی‌ها' })
  async add(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
  ) {
    await this.service.add(user!.id, publicId);
  }

  @Delete(':publicId')
  @HttpCode(204)
  @ApiOperation({ summary: 'حذف از علاقه‌مندی‌ها' })
  async remove(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
  ) {
    await this.service.remove(user!.id, publicId);
  }
}
