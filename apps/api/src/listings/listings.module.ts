import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module.js';
import { SearchModule } from '../search/search.module.js';
import { ListingChecksService } from './listing-checks.service.js';
import { LeadsService } from './leads.service.js';
import { ListingCompareService } from './listing-compare.service.js';
import { ListingExtrasService } from './listing-extras.service.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';

@Module({
  imports: [LocationsModule, SearchModule],
  controllers: [ListingsController],
  providers: [ListingsService, ListingExtrasService, LeadsService, ListingCompareService, ListingChecksService],
  exports: [ListingsService],
})
export class ListingsModule {}
