import { Module } from '@nestjs/common';
import { AmenitiesController } from './amenities.controller.js';
import { LocationsController } from './locations.controller.js';
import { LocationsService } from './locations.service.js';

@Module({
  controllers: [LocationsController, AmenitiesController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
