import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbService } from './db.service.js';
import { ActionItemsController, CapabilitiesController, MeetingsController } from './meetings/meetings.controller.js';
import { MeetingsService } from './meetings/meetings.service.js';

@Module({
  imports: [],
  controllers: [AppController, MeetingsController, ActionItemsController, CapabilitiesController],
  providers: [AppService, DbService, MeetingsService],
})
export class AppModule {}
