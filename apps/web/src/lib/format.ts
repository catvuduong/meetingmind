import type { ActionItem, Meeting } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in the viewer's time zone, YYYY-MM-DD. */
export function todayLocalIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2026-11-12" -> "Nov 12, 2026". */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isOverdue(item: Pick<ActionItem, 'due' | 'status'>, today: string): boolean {
  return item.status === 'open' && item.due !== null && item.due < today;
}

/** Replaces one action item inside a meeting, keeping the rest unchanged. */
export function withActionItem(meeting: Meeting, updated: ActionItem): Meeting {
  return {
    ...meeting,
    actionItems: meeting.actionItems.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
  };
}
