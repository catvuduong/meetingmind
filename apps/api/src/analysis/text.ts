export interface Sentence {
  text: string;
  /** Name from a "Name: ..." transcript line, or null when the line has no speaker label. */
  speaker: string | null;
}

const SPEAKER_LABEL = /^\s*([A-Z][A-Za-z.'-]*(?: [A-Z][A-Za-z.'-]*)?)\s*:\s*(.*)$/;

// Labels that look like speakers ("Action: ...", "Decided: ...") but are not people.
const NOT_SPEAKERS = new Set([
  'action',
  'action items',
  'agenda',
  'agreed',
  'decided',
  'decision',
  'decisions',
  'i',
  'next steps',
  'note',
  'notes',
  'open question',
  'owner',
  'question',
  'status',
  'summary',
  'the',
  'this',
  'todo',
  'topic',
  'update',
  'we',
  'so',
  'also',
  'next',
]);

const LABEL_PREFIX = /^(?:action items?|action|decided|decision|summary|note|owner)\s*:\s*/i;

/** Splits a transcript into sentences, keeping the speaker of each line. */
export function splitSentences(transcript: string): Sentence[] {
  const sentences: Sentence[] = [];
  const normalised = transcript.replace(/[‘’]/g, "'");
  for (const rawLine of normalised.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const label = SPEAKER_LABEL.exec(line);
    const speaker = label && !NOT_SPEAKERS.has(label[1].toLowerCase()) ? label[1] : null;
    const body = speaker && label ? label[2] : line;
    for (const part of body.split(/(?<=[.!?])\s+/)) {
      const text = part.trim();
      if (text) sentences.push({ text, speaker });
    }
  }
  return sentences;
}

/** Removes a leading "Action:" / "Decided:" style label. */
export function stripLabel(text: string): string {
  return text.replace(LABEL_PREFIX, '').trim();
}

export function capitalise(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
