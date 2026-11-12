import { findDue, resolveDueValue } from './due-date.js';
import { escapeRegExp, isRecord, uniqueBy } from './text.js';
import type { ActionItemDraft, Analysis } from './types.js';

const MAX_TEXT = 300;
const MAX_NAME = 60;
const LIMITS = { summary: 5, decisions: 15, actionItems: 25 } as const;

/** Parses the model reply as JSON. Tolerates code fences and prose around the object. Returns undefined when not JSON. */
export function parseModelJson(content: string): unknown {
  const body = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  const candidates = [body, start >= 0 && end > start ? body.slice(start, end + 1) : ''];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

/** True when `name` appears in the transcript as a whole word (case-insensitive). */
export function mentionsName(transcript: string, name: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'iu').test(transcript);
}

/** Keeps the valid strings of a list (up to `max`); returns null when the value is not an array. */
function stringList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const text = item.trim();
    if (!text || text.length > MAX_TEXT) continue;
    strings.push(text);
    if (strings.length === max) break;
  }
  return uniqueBy(strings, (s) => s.toLowerCase());
}

function ownerFrom(value: unknown, transcript: string): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > MAX_NAME) return null;
  // Anti-hallucination: an owner the transcript never mentions is dropped.
  return mentionsName(transcript, name) ? name : null;
}

function dueFrom(value: unknown, transcript: string, meetingDate: string): string | null {
  if (typeof value !== 'string') return null;
  // Anti-hallucination: a due date needs some date phrase in the transcript to be supported.
  if (!findDue(transcript, meetingDate)) return null;
  return resolveDueValue(value, meetingDate);
}

/**
 * Strictly validates the parsed model output. Invalid list entries are dropped; the whole reply is
 * rejected (null) when its shape is wrong or it has no usable summary.
 */
export function validateAnalysis(raw: unknown, transcript: string, meetingDate: string): Analysis | null {
  if (!isRecord(raw)) return null;

  const summary = stringList(raw.summary, LIMITS.summary);
  const decisions = stringList(raw.decisions, LIMITS.decisions);
  if (!summary || summary.length === 0 || !decisions || !Array.isArray(raw.actionItems)) return null;

  const items: ActionItemDraft[] = [];
  for (const entry of raw.actionItems) {
    if (!isRecord(entry) || typeof entry.task !== 'string') continue;
    const task = entry.task.trim();
    if (!task || task.length > MAX_TEXT) continue;
    items.push({
      task,
      owner: ownerFrom(entry.owner, transcript),
      due: dueFrom(entry.due, transcript, meetingDate),
    });
    if (items.length === LIMITS.actionItems) break;
  }

  return {
    summary,
    decisions,
    actionItems: uniqueBy(items, (i) => i.task.toLowerCase()),
  };
}
