import { isIsoDate } from '../analysis/dates.js';
import { mentionsName } from '../analysis/validate.js';
import { buildSeedMeetings } from './seed.js';

const TODAY = '2026-11-12';

describe('demo seed data', () => {
  const seeds = buildSeedMeetings(TODAY);

  it('seeds four meetings with valid dates', () => {
    expect(seeds).toHaveLength(4);
    for (const meeting of seeds) {
      expect(isIsoDate(meeting.date)).toBe(true);
      expect(meeting.transcript.length).toBeGreaterThan(0);
      expect(meeting.transcript.length).toBeLessThanOrEqual(8000);
    }
  });

  it('only names owners who appear in the transcript', () => {
    for (const meeting of seeds) {
      for (const item of meeting.actionItems) {
        if (item.owner) expect(mentionsName(meeting.transcript, item.owner)).toBe(true);
      }
    }
  });

  it('has open items, done items, and at least one overdue item', () => {
    const items = seeds.flatMap((m) => m.actionItems);
    expect(items.some((i) => i.status === 'open')).toBe(true);
    expect(items.some((i) => i.status === 'done')).toBe(true);
    expect(items.some((i) => i.status === 'open' && i.due !== null && i.due < TODAY)).toBe(true);
  });

  it('keeps all due dates relative to the day the seed runs', () => {
    const dues = seeds.flatMap((m) => m.actionItems.map((i) => i.due)).filter((d): d is string => d !== null);
    expect(dues.every((d) => isIsoDate(d))).toBe(true);
  });
});
