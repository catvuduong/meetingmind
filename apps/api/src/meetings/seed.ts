import { addDays } from '../analysis/dates.js';
import type { ActionStatus, MeetingRecord } from './types.js';

/** Bump the suffix to seed a fresh demo set on existing databases. */
export const DEMO_SEED_KEY = 'demo-seed-v1';

interface SeedItem {
  task: string;
  owner: string | null;
  /** Days from today; null for no due date. */
  dueOffset: number | null;
  status?: ActionStatus;
}

interface SeedMeeting {
  title: string;
  /** Days from today (negative = past). */
  offset: number;
  transcript: string[];
  summary: string[];
  decisions: string[];
  actionItems: SeedItem[];
}

// All people, products and numbers below are fictional. Dates are relative to the day the seed runs,
// so the demo always has some items coming due and some overdue.
const SEEDS: SeedMeeting[] = [
  {
    title: 'Tidewell sprint planning',
    offset: -10,
    transcript: [
      'Priya: Welcome, everyone. The sprint goal is invoice reminders, and we keep the scope tight.',
      'Marco: We decided to ship reminders by email only. SMS moves to next quarter.',
      'Lena: I\'ll design the reminder email templates and share them with the team by Wednesday.',
      'Tomas: Action: Tomas to set up the staging queue for reminder jobs before the sprint review.',
      'Aisha: Agreed. I will write the acceptance tests for the retry logic this sprint.',
      'Ben: My main risk is the mail provider rate limit. Timezones for overdue invoices need a check too.',
      'Priya: Great. Let\'s pick up the rest in the review on Friday.',
    ],
    summary: [
      'Sprint goal is invoice reminders, with the scope kept tight.',
      'Reminders ship by email only; SMS moves to next quarter.',
      'The main risks are the mail provider rate limit and timezone handling for overdue invoices.',
    ],
    decisions: ['Ship invoice reminders by email only; SMS moves to next quarter.'],
    actionItems: [
      { task: 'Design the reminder email templates and share them with the team', owner: 'Lena', dueOffset: -7, status: 'done' },
      { task: 'Set up the staging queue for reminder jobs', owner: 'Tomas', dueOffset: -3 },
      { task: 'Write acceptance tests for the retry logic', owner: 'Aisha', dueOffset: 2 },
    ],
  },
  {
    title: 'Pricing review with finance',
    offset: -6,
    transcript: [
      'Marco: Finance wants the Pro plan to stay at 19 euros per seat for now.',
      'Aisha: We decided to add a 14-day free trial for Pro, with no credit card needed.',
      'Ben: I\'ll pull the trial conversion numbers from the analytics dashboard by Friday.',
      'Priya: Action: Priya to draft the public pricing page copy with the new trial wording.',
      'Marco: We agreed the annual discount stays at 15 percent.',
      'Lena: Open question, do we grandfather existing customers into the old price?',
    ],
    summary: [
      'Finance wants the Pro plan to stay at 19 euros per seat for now.',
      'A 14-day free trial for Pro is approved, with no credit card needed.',
      'The annual discount stays at 15 percent.',
      'Open question: whether existing customers are grandfathered into the old price.',
    ],
    decisions: [
      'Add a 14-day free trial for the Pro plan, with no credit card needed.',
      'Keep the annual discount at 15 percent.',
    ],
    actionItems: [
      { task: 'Pull the trial conversion numbers from the analytics dashboard', owner: 'Ben', dueOffset: 1 },
      { task: 'Draft the public pricing page copy with the new trial wording', owner: 'Priya', dueOffset: -1, status: 'done' },
    ],
  },
  {
    title: 'Onboarding redesign kickoff',
    offset: -3,
    transcript: [
      'Lena: The goal is to cut time to first invoice from 20 minutes to under 5.',
      'Tomas: The current checklist has nine steps, and most people drop off at step four.',
      'Aisha: We will go with a three-step guided setup and move bank linking later.',
      'Ben: I\'ll run five user interviews with recent sign-ups next week.',
      'Priya: Tomas, can you audit the step four drop-off in the funnel data?',
      'Tomas: Yes, I\'ll have the funnel audit ready by Monday.',
    ],
    summary: [
      'The goal is to cut time to first invoice from 20 minutes to under 5.',
      'The current nine-step checklist loses most people at step four.',
      'The team will go with a three-step guided setup and move bank linking later.',
    ],
    decisions: ['Go with a three-step guided setup; bank linking moves later.'],
    actionItems: [
      { task: 'Run five user interviews with recent sign-ups', owner: 'Ben', dueOffset: 7 },
      { task: 'Audit the step four drop-off in the funnel data', owner: 'Tomas', dueOffset: 4 },
      { task: 'Draft the three-step guided setup flow', owner: null, dueOffset: -1, status: 'done' },
    ],
  },
  {
    title: 'Customer escalation: CSV export bug',
    offset: -1,
    transcript: [
      'Priya: A pilot customer reports that CSV exports drop the last row.',
      'Ben: Reproduced on staging. It only happens when an export has exactly 500 rows.',
      'Marco: We decided to hotfix the pagination bug in the export job today.',
      'Tomas: I\'ll deploy the hotfix to staging this afternoon and tell support when it is live.',
      'Lena: Action: Lena to draft the update email for the pilot account.',
      'Aisha: Should we add a regression test for the 500-row boundary? Yes, add it.',
    ],
    summary: [
      'A pilot customer reports that CSV exports drop the last row.',
      'The bug reproduces on staging only when an export has exactly 500 rows.',
      'A hotfix to the export pagination job is planned for today.',
    ],
    decisions: ['Hotfix the pagination bug in the export job today.'],
    actionItems: [
      { task: 'Deploy the hotfix to staging and tell support when it is live', owner: 'Tomas', dueOffset: 0 },
      { task: 'Draft the update email for the pilot account', owner: 'Lena', dueOffset: 0 },
      { task: 'Add a regression test for the 500-row export boundary', owner: null, dueOffset: null },
    ],
  },
];

/** Demo meetings with fixed analysis results. They are stored with source "rules" because the analysis was prepared by hand. */
export function buildSeedMeetings(today: string): MeetingRecord[] {
  return SEEDS.map((seed) => ({
    title: seed.title,
    date: addDays(today, seed.offset),
    transcript: seed.transcript.join('\n'),
    summary: seed.summary,
    decisions: seed.decisions,
    source: 'rules',
    actionItems: seed.actionItems.map((item) => ({
      task: item.task,
      owner: item.owner,
      due: item.dueOffset === null ? null : addDays(today, item.dueOffset),
      status: item.status ?? 'open',
    })),
  }));
}
