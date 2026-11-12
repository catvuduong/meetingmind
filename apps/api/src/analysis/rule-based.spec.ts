import { analyseWithRules } from './rule-based.js';
import { splitSentences } from './text.js';

const MEETING = '2026-11-12';

// Fictional product meeting. Keep in sync with the "Load sample" text in apps/web/src/lib/sample.ts.
const SAMPLE_TRANSCRIPT = [
  'Priya: Thanks everyone. The goal today is to pick the scope for the Tidewell 2.0 beta, which we need locked by Friday.',
  'Marco: We agreed last week to drop the CSV import from the beta. It is too risky for the launch window.',
  'Lena: Agreed. The onboarding checklist is still the top priority, and I want the new empty states in before the beta.',
  "Tomas: I'll send the revised beta scope doc to the whole team by Wednesday.",
  'Aisha: Decided: we will go with the monthly price of 12 dollars for the beta cohort. No annual plan yet.',
  'Ben: Action: Ben to set up the beta sign-up form and connect it to the CRM by next week.',
  'Priya: Marco, can you check with legal about the data retention wording?',
  "Marco: Yes, I'll confirm the retention wording with legal by Thursday.",
  "Lena: Two open questions: the export bug and the mobile layout. I'm not sure which one lands first.",
  "Aisha: Let's keep the mobile layout in the beta if it stays under two days of work.",
  'Priya: Okay. Summary: scope locked, pricing set, three follow-ups. Thanks all.',
].join('\n');

describe('splitSentences', () => {
  it('keeps the speaker of each line and splits sentences', () => {
    const sentences = splitSentences('Priya: First point. Second point!\nAction: send the deck.\nMarco: Yes.');
    expect(sentences).toEqual([
      { text: 'First point.', speaker: 'Priya' },
      { text: 'Second point!', speaker: 'Priya' },
      { text: 'Action: send the deck.', speaker: null },
      { text: 'Yes.', speaker: 'Marco' },
    ]);
  });

  it('does not treat labels such as "Decided:" as speakers', () => {
    expect(splitSentences('Decided: ship on Friday.')[0].speaker).toBeNull();
  });
});

describe('analyseWithRules', () => {
  const result = analyseWithRules(SAMPLE_TRANSCRIPT, MEETING);

  it('extracts the three commitments with owner and due date', () => {
    expect(result.actionItems).toEqual([
      { task: 'Send the revised beta scope doc to the whole team', owner: 'Tomas', due: '2026-11-18' },
      { task: 'Set up the beta sign-up form and connect it to the CRM', owner: 'Ben', due: '2026-11-19' },
      { task: 'Confirm the retention wording with legal', owner: 'Marco', due: '2026-11-12' },
    ]);
  });

  it('extracts the explicit decisions and ignores one-word agreements', () => {
    expect(result.decisions).toEqual([
      'We agreed last week to drop the CSV import from the beta.',
      'We will go with the monthly price of 12 dollars for the beta cohort.',
    ]);
  });

  it('writes a 3 to 5 bullet summary without speaker names or filler', () => {
    expect(result.summary.length).toBeGreaterThanOrEqual(3);
    expect(result.summary.length).toBeLessThanOrEqual(5);
    for (const bullet of result.summary) {
      expect(bullet).not.toMatch(/^(Thanks|Okay|Agreed)/);
      expect(bullet).not.toMatch(/^[A-Z][a-z]+: /);
    }
  });

  it('does not treat questions or vague future talk as action items', () => {
    const tasks = result.actionItems.map((item) => item.task.toLowerCase()).join(' | ');
    expect(tasks).not.toContain('check with legal');
    expect(tasks).not.toContain('keep the mobile layout');
  });

  it('leaves the owner null when a commitment has no named person', () => {
    const items = analyseWithRules('We will ship the release by Friday.', MEETING).actionItems;
    expect(items).toEqual([{ task: 'Ship the release', owner: null, due: '2026-11-13' }]);
  });

  it('takes the owner from an @mention', () => {
    const items = analyseWithRules('Please review the draft @maria by next week.', MEETING).actionItems;
    expect(items).toEqual([{ task: 'Please review the draft', owner: 'Maria', due: '2026-11-19' }]);
  });

  it('does not treat an email address as a mention', () => {
    expect(analyseWithRules('Contact ops@example.com about the outage.', MEETING).actionItems).toEqual([]);
  });

  it('returns no action items for a plain discussion', () => {
    const result = analyseWithRules('We talked about the weather. It was nice and sunny today.', MEETING);
    expect(result.actionItems).toEqual([]);
    expect(result.decisions).toEqual([]);
    expect(result.summary.length).toBeGreaterThanOrEqual(1);
  });

  it('still returns one summary line for a very short transcript', () => {
    expect(analyseWithRules('Ok.', MEETING).summary).toEqual(['Ok.']);
  });

  it('dedupes repeated action items', () => {
    const text = "Tomas: I'll write the FAQ by Friday.\nTomas: I'll write the FAQ by Friday.";
    expect(analyseWithRules(text, MEETING).actionItems).toHaveLength(1);
  });
});
