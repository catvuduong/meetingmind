import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { todayIso } from '../analysis/dates.js';
import { isRecord } from '../analysis/text.js';
import { parseId, parseItemFilter, parseNewMeeting, parseSearch, parseStatus } from './meeting-input.js';
import { MeetingsService } from './meetings.service.js';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.meetings.createMeeting(parseNewMeeting(body, todayIso()));
  }

  @Get()
  list(@Query('q') q?: unknown) {
    return this.meetings.listMeetings(parseSearch(q));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.meetings.getMeeting(parseId(id));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.meetings.deleteMeeting(parseId(id));
  }
}

@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@Query('owner') owner?: unknown, @Query('status') status?: unknown) {
    return this.meetings.listActionItems(parseItemFilter(owner, status));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const status = parseStatus(isRecord(body) ? body.status : undefined);
    return this.meetings.updateActionItem(parseId(id), status);
  }
}

@Controller('capabilities')
export class CapabilitiesController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  capabilities() {
    return { ai: this.meetings.aiEnabled };
  }
}
