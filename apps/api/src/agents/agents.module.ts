import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { AgenciesService } from './agencies.service.js';
import { AgenciesController, AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';
import { PanelController } from './panel.controller.js';
import { PanelService } from './panel.service.js';

@Module({
  imports: [LocationsModule, ListingsModule],
  controllers: [AgentsController, AgenciesController, PanelController],
  providers: [AgentsService, AgenciesService, PanelService],
  exports: [AgentsService],
})
export class AgentsModule {}