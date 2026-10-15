import {
  createSavedSearchSchema,
  updateSavedSearchSchema,
  type CreateSavedSearchInput,
  type UpdateSavedSearchInput,
} from '@ashian/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { UuidPipe } from '../common/pipes.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SavedSearchesService } from './saved-searches.service.js';

@ApiTags('saved-searches')
@Controller('saved-searches')
export class SavedSearchesController {
  constructor(private readonly service: SavedSearchesService) {}

  @Get()
  @ApiOperation({ summary: 'جستجوهای ذخیره‌شده‌ی من' })
  list(@CurrentUser({ required: true }) user: AuthUser | undefined) {
    return this.service.list(user!.id);
  }

  @Post()
  @ApiOperation({ summary: 'ذخیره‌ی جستجو و هشدار آگهی تازه' })
  create(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(createSavedSearchSchema)) body: CreateSavedSearchInput,
  ) {
    return this.service.create(user!.id, body);
  }

  @Patch(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'ویرایش نام، تناوب و کانال هشدار' })
  async update(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(updateSavedSearchSchema)) body: UpdateSavedSearchInput,
  ) {
    await this.service.update(user!.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'حذف جستجوی ذخیره‌شده' })
  async remove(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('id', new UuidPipe()) id: string,
  ) {
    await this.service.remove(user!.id, id);
  }
}
