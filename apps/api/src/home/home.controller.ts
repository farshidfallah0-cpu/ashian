import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { HomeService } from './home.service.js';

@ApiTags('home')
@Public()
@Controller('home')
export class HomeController {
  constructor(private readonly service: HomeService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'داده‌ی ویترین صفحه‌ی اصلی (محله‌های محبوب، تازه‌ها، شمارش نوع ملک)' })
  home() {
    return this.service.get();
  }
}
