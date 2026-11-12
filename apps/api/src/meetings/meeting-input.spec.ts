import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MAX_TRANSCRIPT_LENGTH,
  parseId,
  parseItemFilter,
  parseNewMeeting,
  parseSearch,
  parseStatus,
} from './meeting-input.js';

const TODAY = '2026-11-12';

describe('parseNewMeeting', () => {
  it('trims the transcript and fills in the default date and title', () => {
    expect(parseNewMeeting({ transcript: '  Priya: Hello.  ' }, TODAY)).toEqual({
      transcript: 'Priya: Hello.',
      date: TODAY,
      title: 'Meeting on 2026-11-12',
    });
  });

  it('keeps a supplied title and date', () => {
    expect(parseNewMeeting({ transcript: 'x', title: ' Pricing ', date: '2026-10-01' }, TODAY)).toEqual({
      transcript: 'x',
      title: 'Pricing',
      date: '2026-10-01',
    });
  });

  it('rejects a body that is not an object', () => {
    expect(() => parseNewMeeting(null, TODAY)).toThrow(BadRequestException);
    expect(() => parseNewMeeting(['x'], TODAY)).toThrow(BadRequestException);
  });

  it('rejects an empty or whitespace-only transcript', () => {
    expect(() => parseNewMeeting({}, TODAY)).toThrow('transcript is required');
    expect(() => parseNewMeeting({ transcript: '   \n ' }, TODAY)).toThrow('transcript is required');
  });

  it('rejects a non-string transcript', () => {
    expect(() => parseNewMeeting({ transcript: 42 }, TODAY)).toThrow('transcript must be a string');
  });

  it('accepts exactly 8000 characters and rejects one more', () => {
    const exact = 'a'.repeat(MAX_TRANSCRIPT_LENGTH);
    expect(parseNewMeeting({ transcript: exact }, TODAY).transcript).toHaveLength(MAX_TRANSCRIPT_LENGTH);
    expect(() => parseNewMeeting({ transcript: `${exact}a` }, TODAY)).toThrow(
      'transcript must be 8000 characters or fewer',
    );
  });

  it('rejects an invalid or impossible date', () => {
    expect(() => parseNewMeeting({ transcript: 'x', date: 'tomorrow' }, TODAY)).toThrow(BadRequestException);
    expect(() => parseNewMeeting({ transcript: 'x', date: '2026-02-30' }, TODAY)).toThrow(BadRequestException);
  });

  it('rejects an over-long title', () => {
    expect(() => parseNewMeeting({ transcript: 'x', title: 't'.repeat(121) }, TODAY)).toThrow(BadRequestException);
  });
});

describe('query and path parsing', () => {
  it('parseSearch trims, treats blank as no search, and rejects arrays', () => {
    expect(parseSearch(undefined)).toBeNull();
    expect(parseSearch('   ')).toBeNull();
    expect(parseSearch(' pricing ')).toBe('pricing');
    expect(() => parseSearch(['a', 'b'])).toThrow(BadRequestException);
  });

  it('parseItemFilter accepts owner and status and rejects unknown statuses', () => {
    expect(parseItemFilter(undefined, undefined)).toEqual({});
    expect(parseItemFilter('Priya', 'done')).toEqual({ owner: 'Priya', status: 'done' });
    expect(() => parseItemFilter(undefined, 'archived')).toThrow('status must be "open" or "done"');
  });

  it('parseStatus only accepts open or done', () => {
    expect(parseStatus('open')).toBe('open');
    expect(parseStatus('done')).toBe('done');
    expect(() => parseStatus('DONE')).toThrow(BadRequestException);
    expect(() => parseStatus(undefined)).toThrow(BadRequestException);
  });

  it('parseId requires a positive integer and maps out-of-range ids to 404', () => {
    expect(parseId('42')).toBe(42);
    expect(() => parseId('abc')).toThrow(BadRequestException);
    expect(() => parseId('0')).toThrow(BadRequestException);
    expect(() => parseId('-3')).toThrow(BadRequestException);
    expect(() => parseId('99999999999')).toThrow(BadRequestException);
    expect(() => parseId('3000000000')).toThrow(NotFoundException);
  });
});
