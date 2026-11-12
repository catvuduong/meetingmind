import { findDue, resolveDueValue } from './due-date.js';

// 2026-11-12 is a Thursday.
const MEETING = '2026-11-12';

describe('findDue', () => {
  it.each([
    ['Send it by Friday.', '2026-11-13', 'Friday'],
    ['Ship it on Wednesday.', '2026-11-18', 'Wednesday'],
    ['We can talk tomorrow.', '2026-11-13', 'tomorrow'],
    ['Done today.', '2026-11-12', 'today'],
    ['Follow up next week.', '2026-11-19', 'next week'],
    ['Due by end of the week.', '2026-11-13', 'end of the week'],
    ['Reply in 3 days.', '2026-11-15', 'in 3 days'],
    ['Reply in 2 weeks.', '2026-11-26', 'in 2 weeks'],
    ['Launch on Nov 20.', '2026-11-20', 'Nov 20'],
    ['Launch on 20 November.', '2026-11-20', '20 November'],
    ['Launch on November 20th, 2027.', '2027-11-20', 'November 20th, 2027'],
    ['Ship on 2026-12-01.', '2026-12-01', '2026-12-01'],
  ])('resolves "%s" to %s', (sentence, date, phrase) => {
    expect(findDue(sentence, MEETING)).toEqual({ date, text: phrase });
  });

  it('treats "next Friday" as that weekday in the following calendar week', () => {
    expect(findDue('Review next Friday.', MEETING)?.date).toBe('2026-11-20');
  });

  it('treats a plain weekday that is today as today', () => {
    expect(findDue('Ship by Thursday.', MEETING)?.date).toBe('2026-11-12');
  });

  it('uses the earliest phrase in the sentence', () => {
    expect(findDue('Send by Wednesday, not tomorrow.', MEETING)?.date).toBe('2026-11-18');
  });

  it('rejects impossible calendar dates', () => {
    expect(findDue('Ship on 2026-02-30.', MEETING)).toBeNull();
    expect(findDue('Ship on Feb 30.', MEETING)).toBeNull();
  });

  it('returns null when there is no date phrase', () => {
    expect(findDue('We will improve the onboarding flow.', MEETING)).toBeNull();
    expect(findDue('It costs 12 dollars per seat.', MEETING)).toBeNull();
  });
});

describe('resolveDueValue', () => {
  it('keeps a valid ISO date as it is', () => {
    expect(resolveDueValue('2026-11-20', MEETING)).toBe('2026-11-20');
  });

  it('resolves a due phrase the model returned instead of a date', () => {
    expect(resolveDueValue('Friday', MEETING)).toBe('2026-11-13');
  });

  it('returns null for unusable values', () => {
    expect(resolveDueValue('soon-ish', MEETING)).toBeNull();
    expect(resolveDueValue('2026-13-45', MEETING)).toBeNull();
  });
});
