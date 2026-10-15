import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module.js';
import { MediaController, MediaFilesController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({
  imports: [ListingsModule],
  controllers: [MediaController, MediaFilesController],
  providers: [MediaService],
})
export class MediaModule {}
