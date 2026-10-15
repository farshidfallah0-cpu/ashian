import { Module } from '@nestjs/common';
import { SearchIndexerService } from './search-indexer.service.js';
import { SearchController } from './search.controller.js';
import { SearchApiService } from './search.service.js';

@Module({
  controllers: [SearchController],
  providers: [SearchApiService, SearchIndexerService],
  exports: [SearchApiService],
})
export class SearchModule {}
