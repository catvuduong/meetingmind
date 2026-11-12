import { BadRequestException, NotFoundException } from '@nestjs/common';
import { isIsoDate } from '../analysis/dates.js';
import { isRecord } from '../analysis/text.js';
import type { ActionStatus } from './types.js';

export const MAX_TRANSCRIPT_LENGTH = 8000;
const MAX_TITLE_LENGTH = 120;
const MAX_SEARCH_LENGTH = 200;
const MAX_OWNER_LENGTH = 80;
const MAX_INT4 = 2147483647;

export interface NewMeetingInput {
  title: string;
  date: string;
  transcript: string;
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const text = value.trim();
  if (!text) return undefined;
  if (text.length > max) throw new BadRequestException(`${field} must be ${max} characters or fewer`);
  return text;
}

export function parseNewMeeting(body: unknown, today: string): NewMeetingInput {
  if (!isRecord(body)) throw new BadRequestException('Request body must be a JSON object');
  if (body.transcript !== undefined && body.transcript !== null && typeof body.transcript !== 'string') {
    throw new BadRequestException('transcript must be a string');
  }
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (!transcript) throw new BadRequestException('transcript is required');
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    throw new BadRequestException(`transcript must be ${MAX_TRANSCRIPT_LENGTH} characters or fewer`);
  }

  const date = optionalText(body.date, 'date', 10) ?? today;
  if (!isIsoDate(date)) throw new BadRequestException('date must be a real calendar date in YYYY-MM-DD format');
  const title = optionalText(body.title, 'title', MAX_TITLE_LENGTH) ?? `Meeting on ${date}`;

  return { title, date, transcript };
}

export function parseSearch(value: unknown): string | null {
  const text = optionalText(value, 'q', MAX_SEARCH_LENGTH);
  return text ?? null;
}

export function parseItemFilter(owner: unknown, status: unknown): { owner?: string; status?: ActionStatus } {
  const filter: { owner?: string; status?: ActionStatus } = {};
  const ownerText = optionalText(owner, 'owner', MAX_OWNER_LENGTH);
  if (ownerText) filter.owner = ownerText;
  if (status !== undefined && status !== '') filter.status = parseStatus(status, 'status');
  return filter;
}

export function parseStatus(value: unknown, field = 'status'): ActionStatus {
  if (value === 'open' || value === 'done') return value;
  throw new BadRequestException(`${field} must be "open" or "done"`);
}

/** Parses a path id. Non-numeric input is a 400; ids beyond the database range cannot exist, so they are a 404. */
export function parseId(raw: string): number {
  if (!/^[1-9]\d{0,9}$/.test(raw)) throw new BadRequestException('id must be a positive integer');
  const id = Number(raw);
  if (id > MAX_INT4) throw new NotFoundException('Not found');
  return id;
}
