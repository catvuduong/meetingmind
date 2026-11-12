import { addDays, isIsoDate, makeIsoDate, weekdayOf, yearOf } from './dates.js';

export interface DueMatch {
  /** Resolved calendar date, YYYY-MM-DD. */
  date: string;
  /** The phrase that produced it, so callers can strip it from task text. */
  text: string;
}

const MONTH_NAMES = 'january february march april may june july august september october november december'.split(' ');
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';

function monthIndex(token: string): number {
  return MONTH_NAMES.findIndex((name) => name.startsWith(token.toLowerCase().slice(0, 3)));
}

function dateOrNull(year: number, monthZeroBased: number, day: number): string | null {
  return monthZeroBased < 0 ? null : makeIsoDate(year, monthZeroBased + 1, day);
}

/** Smallest date on or after `start` that falls on the given weekday (0 = Sunday). */
function nextWeekday(target: number, start: string): string {
  return addDays(start, (target - weekdayOf(start) + 7) % 7);
}

/** The given weekday in the calendar week (Monday-Sunday) after the week containing `day`. */
function weekdayInNextWeek(target: number, day: string): string {
  const mondayBased = (weekday: number) => (weekday + 6) % 7;
  const nextMonday = addDays(day, 7 - mondayBased(weekdayOf(day)));
  return addDays(nextMonday, mondayBased(target));
}

interface Rule {
  pattern: RegExp;
  resolve: (match: RegExpMatchArray, meetingDate: string) => string | null;
}

// Order matters only as a tie-break when two phrases start at the same position.
const RULES: Rule[] = [
  { pattern: /\b\d{4}-\d{2}-\d{2}\b/g, resolve: (m) => (isIsoDate(m[0]) ? m[0] : null) },
  { pattern: /\b(?:today|tonight)\b/gi, resolve: (_m, day) => day },
  { pattern: /\btomorrow\b/gi, resolve: (_m, day) => addDays(day, 1) },
  { pattern: /\bnext week\b/gi, resolve: (_m, day) => addDays(day, 7) },
  { pattern: /\b(?:this week|end of (?:the )?week)\b/gi, resolve: (_m, day) => nextWeekday(5, day) },
  {
    pattern: /\bin (\d{1,2}) (days?|weeks?)\b/gi,
    resolve: (m, day) => addDays(day, Number(m[1]) * (m[2].toLowerCase().startsWith('week') ? 7 : 1)),
  },
  {
    // "Friday" = next occurrence on or after the meeting; "next Friday" = that weekday in the following week.
    pattern: new RegExp(`\\b(next )?${WEEKDAY}\\b`, 'gi'),
    resolve: (m, day) => {
      const target = WEEKDAY_NAMES.indexOf(m[2].toLowerCase());
      return m[1] ? weekdayInNextWeek(target, day) : nextWeekday(target, day);
    },
  },
  {
    // "Nov 20", "November 20th, 2027"
    pattern: new RegExp(`\\b${MONTH}\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b(?:,? (\\d{4}))?`, 'gi'),
    resolve: (m, day) => dateOrNull(m[3] ? Number(m[3]) : yearOf(day), monthIndex(m[1]), Number(m[2])),
  },
  {
    // "20 November", "20th of Nov 2027"
    pattern: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? (?:of )?${MONTH}\\b(?:,? (\\d{4}))?`, 'gi'),
    resolve: (m, day) => dateOrNull(m[3] ? Number(m[3]) : yearOf(day), monthIndex(m[2]), Number(m[1])),
  },
];

/** Finds the earliest due-date phrase in `text` and resolves it against the meeting date. */
export function findDue(text: string, meetingDate: string): DueMatch | null {
  let best: { match: DueMatch; index: number; rank: number } | null = null;
  for (const [rank, rule] of RULES.entries()) {
    for (const match of text.matchAll(rule.pattern)) {
      const date = rule.resolve(match, meetingDate);
      const index = match.index ?? 0;
      if (!date) continue;
      if (!best || index < best.index || (index === best.index && rank < best.rank)) {
        best = { match: { date, text: match[0] }, index, rank };
      }
    }
  }
  return best?.match ?? null;
}

/** Accepts an ISO date or a due phrase such as "Friday" and returns YYYY-MM-DD, or null. */
export function resolveDueValue(value: string, meetingDate: string): string | null {
  const trimmed = value.trim();
  if (isIsoDate(trimmed)) return trimmed;
  return findDue(trimmed, meetingDate)?.date ?? null;
}
