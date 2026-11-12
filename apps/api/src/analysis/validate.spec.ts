import { mentionsName, parseModelJson, validateAnalysis } from './validate.js';

const MEETING = '2026-11-12';
const TRANSCRIPT = [
  'Priya: We need the export fixed by Friday.',
  'Marco: I will look into the retry logic.',
].join('\n');

function reply(overrides: Record<string, unknown> = {}) {
  return {
    summary: ['Export fix is due Friday.', 'Retry logic is being checked.'],
    decisions: [],
    actionItems: [{ task: 'Look into the retry logic', owner: 'Marco', due: null }],
    ...overrides,
  };
}

describe('parseModelJson', () => {
  it('parses a plain JSON object', () => {
    expect(parseModelJson('{"summary": []}')).toEqual({ summary: [] });
  });

  it('parses a JSON object wrapped in a code fence or prose', () => {
    expect(parseModelJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Here you go: {"a": 1} hope it helps')).toEqual({ a: 1 });
  });

  it('returns undefined for text that is not JSON', () => {
    expect(parseModelJson('I cannot help with that.')).toBeUndefined();
    expect(parseModelJson('{"summary": [')).toBeUndefined();
  });
});

describe('mentionsName (owner-in-transcript check)', () => {
  it('matches whole words, case-insensitively', () => {
    expect(mentionsName(TRANSCRIPT, 'priya')).toBe(true);
    expect(mentionsName(TRANSCRIPT, 'Marco')).toBe(true);
  });

  it('does not match inside a longer word', () => {
    expect(mentionsName(TRANSCRIPT, 'Mar')).toBe(false);
    expect(mentionsName(TRANSCRIPT, 'Priyanka')).toBe(false);
  });

  it('treats regex characters in the name literally', () => {
    expect(mentionsName('Owner: Jo (ops)', 'Jo (ops)')).toBe(true);
    expect(mentionsName(TRANSCRIPT, '.*')).toBe(false);
  });
});

describe('validateAnalysis', () => {
  it('accepts a well-formed reply', () => {
    expect(validateAnalysis(reply(), TRANSCRIPT, MEETING)).toEqual({
      summary: ['Export fix is due Friday.', 'Retry logic is being checked.'],
      decisions: [],
      actionItems: [{ task: 'Look into the retry logic', owner: 'Marco', due: null }],
    });
  });

  it('rejects anything that is not an object', () => {
    expect(validateAnalysis(null, TRANSCRIPT, MEETING)).toBeNull();
    expect(validateAnalysis(['summary'], TRANSCRIPT, MEETING)).toBeNull();
    expect(validateAnalysis('text', TRANSCRIPT, MEETING)).toBeNull();
  });

  it('rejects a reply with the wrong shape', () => {
    expect(validateAnalysis(reply({ summary: 'one line' }), TRANSCRIPT, MEETING)).toBeNull();
    expect(validateAnalysis(reply({ decisions: undefined }), TRANSCRIPT, MEETING)).toBeNull();
    expect(validateAnalysis(reply({ actionItems: {} }), TRANSCRIPT, MEETING)).toBeNull();
  });

  it('rejects a reply with no usable summary', () => {
    expect(validateAnalysis(reply({ summary: [] }), TRANSCRIPT, MEETING)).toBeNull();
    expect(validateAnalysis(reply({ summary: ['   ', 42] }), TRANSCRIPT, MEETING)).toBeNull();
  });

  it('drops invalid action items and keeps the valid ones', () => {
    const result = validateAnalysis(
      reply({
        actionItems: [
          { task: '', owner: 'Priya' },
          { owner: 'Priya' },
          'not an object',
          { task: 'Fix the export', owner: 'Priya', due: null },
        ],
      }),
      TRANSCRIPT,
      MEETING,
    );
    expect(result?.actionItems).toEqual([{ task: 'Fix the export', owner: 'Priya', due: null }]);
  });

  it('sets an owner to null when the transcript never mentions them', () => {
    const result = validateAnalysis(
      reply({ actionItems: [{ task: 'Write the FAQ', owner: 'Dana Smith', due: null }] }),
      TRANSCRIPT,
      MEETING,
    );
    expect(result?.actionItems[0].owner).toBeNull();
  });

  it('keeps a due date only when the transcript states a date', () => {
    const withDate = validateAnalysis(
      reply({ actionItems: [{ task: 'Fix the export', owner: 'Priya', due: '2026-11-13' }] }),
      TRANSCRIPT,
      MEETING,
    );
    expect(withDate?.actionItems[0].due).toBe('2026-11-13');

    const noDateCue = validateAnalysis(
      reply({ actionItems: [{ task: 'Fix the export', owner: 'Priya', due: '2026-11-13' }] }),
      'Priya: The export is broken.',
      MEETING,
    );
    expect(noDateCue?.actionItems[0].due).toBeNull();
  });

  it('turns a due phrase into a date and drops an impossible one', () => {
    const result = validateAnalysis(
      reply({
        actionItems: [
          { task: 'Fix the export', owner: 'Priya', due: 'Friday' },
          { task: 'Write the FAQ', owner: 'Marco', due: '2026-02-30' },
        ],
      }),
      TRANSCRIPT,
      MEETING,
    );
    expect(result?.actionItems.map((i) => i.due)).toEqual(['2026-11-13', null]);
  });

  it('caps the number of summary bullets', () => {
    const result = validateAnalysis(
      reply({ summary: ['a 1', 'b 2', 'c 3', 'd 4', 'e 5', 'f 6', 'g 7'] }),
      TRANSCRIPT,
      MEETING,
    );
    expect(result?.summary).toHaveLength(5);
  });
});
