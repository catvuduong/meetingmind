import { findDue, type DueMatch } from './due-date.js';
import {
  capitalise,
  escapeRegExp,
  stripLabel,
  splitSentences,
  truncate,
  uniqueBy,
  type Sentence,
} from './text.js';
import type { ActionItemDraft, Analysis } from './types.js';

const MAX_TEXT = 200;
const MAX_LINE = 240;
const MAX_SUMMARY = 5;
const MAX_DECISIONS = 15;
const MAX_ACTIONS = 25;

const DECISION = /\b(decided|decision|agreed|we will go with|we'll go with)\b/i;
const EXPLICIT_ACTION = /(?:^|\s)action:|\baction items?\b|\bto[- ]?do\b|(?:^|\s)@[A-Za-z]/i;
const COMMITMENT = /\b(?:I'll|I will|we'll|we will|will|needs? to|need to|should|is going to)\b/i;
const FILLER = /^(?:thanks|thank you|ok|okay|yes|yeah|sure|hi|hello|bye|cheers|great|perfect)\b/i;
const MENTION = /(?:^|\s)@([A-Za-z][A-Za-z'-]{1,30})/;
const NAMED_OWNER = /^([A-Z][a-z]{1,30})\s+(?:will|to|needs?\s+to|should|is going to)\b/;
const NAMED_PREFIX = /^[A-Z][a-z]{1,30}\s+(?:will|to|needs?\s+to|should|is going to)\s+/;
const I_COMMITMENT_PREFIX = /^.*?\b(?:I'll|I will|we'll|we will)\s+/i;

// Capitalised words that start sentences but are never a person's name.
const OWNER_STOPWORDS = new Set([
  'Action', 'Also', 'After', 'Before', 'Decision', 'Everyone', 'Five', 'Four', 'Going', 'Good', 'Great',
  'Happy', 'Hello', 'Hi', 'I', 'If', 'It', 'Let', 'Looks', 'Maybe', 'Next', 'No', 'Nobody', 'Note', 'Ok',
  'Okay', 'Once', 'Please', 'Perfect', 'Seems', 'Since', 'Someone', 'Sounds', 'Summary', 'Sure', 'Team',
  'Thanks', 'That', 'The', 'Then', 'There', 'They', 'This', 'Three', 'Two', 'We', 'Works', 'Yes', 'You',
]);

function isQuestion(text: string): boolean {
  return text.trimEnd().endsWith('?');
}

function detectOwner(text: string, speaker: string | null): string | null {
  const mention = MENTION.exec(text);
  if (mention) return capitalise(mention[1]);
  const named = NAMED_OWNER.exec(stripLabel(text));
  if (named && !OWNER_STOPWORDS.has(named[1])) return named[1];
  if (/\bI(?:'ll| will)\b/.test(text)) return speaker;
  return null;
}

function isCommitment(text: string, owner: string | null, due: DueMatch | null): boolean {
  if (isQuestion(text)) return false;
  if (EXPLICIT_ACTION.test(text)) return true;
  // A bare "will" is too common to trust: require a named owner or a due date as well.
  return COMMITMENT.test(text) && (owner !== null || due !== null);
}

/** Turns "I'll send the deck by Friday." into "Send the deck". */
function taskFrom(text: string, due: DueMatch | null): string {
  let task = stripLabel(text).replace(/(?:^|\s)@[A-Za-z][A-Za-z'-]*/g, ' ').trim();
  const commitment = I_COMMITMENT_PREFIX.exec(task);
  if (commitment) task = task.slice(commitment[0].length);
  else task = task.replace(NAMED_PREFIX, '');
  if (due) {
    task = task.replace(new RegExp(`\\s*(?:by |on |before |due )?${escapeRegExp(due.text)}`, 'i'), '');
  }
  task = task.replace(/\s+/g, ' ').replace(/[\s.!]+$/, '').trim();
  return truncate(capitalise(task || text.trim()), MAX_TEXT);
}

function pickSummary(sentences: Sentence[], transcript: string): string[] {
  const informative = sentences.filter(
    (s) => s.text.length >= 30 && !isQuestion(s.text) && !FILLER.test(s.text),
  );
  const pool = informative.length > 0 ? informative : sentences;
  if (pool.length === 0) return [truncate(transcript.trim(), MAX_LINE)];
  const longest = new Set([...pool].sort((a, b) => b.text.length - a.text.length).slice(0, MAX_SUMMARY));
  const bullets = pool
    .filter((s) => longest.has(s))
    .map((s) => capitalise(truncate(stripLabel(s.text), MAX_LINE)));
  return uniqueBy(bullets, (b) => b.toLowerCase());
}

/**
 * Deterministic fallback used when no AI key is set or the AI call fails.
 * Heuristics: decisions use "decided/agreed/we will go with"; action items need a commitment
 * ("action:", "to do", "@name", or "will/I'll" plus an owner or a due date); due dates are parsed
 * from phrases such as "Friday", "next week", "tomorrow", "in 3 days" or "Nov 20".
 */
export function analyseWithRules(transcript: string, meetingDate: string): Analysis {
  const sentences = splitSentences(transcript);
  const decisions: string[] = [];
  const actionItems: ActionItemDraft[] = [];

  for (const sentence of sentences) {
    const { text, speaker } = sentence;
    if (isQuestion(text)) continue;

    if (text.length >= 12 && DECISION.test(text)) {
      decisions.push(capitalise(truncate(stripLabel(text), MAX_LINE)));
    }

    const due = findDue(text, meetingDate);
    const owner = detectOwner(text, speaker);
    if (isCommitment(text, owner, due)) {
      actionItems.push({ task: taskFrom(text, due), owner, due: due?.date ?? null });
    }
  }

  return {
    summary: pickSummary(sentences, transcript),
    decisions: uniqueBy(decisions, (d) => d.toLowerCase()).slice(0, MAX_DECISIONS),
    actionItems: uniqueBy(actionItems, (a) => a.task.toLowerCase()).slice(0, MAX_ACTIONS),
  };
}
