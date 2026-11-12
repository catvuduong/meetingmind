'use client';

import type { ActionItem, Meeting } from '@/lib/types';
import { ActionItemsTable } from './action-items-table';

interface Props {
  meeting: Meeting;
  onItemChange: (item: ActionItem) => void;
}

/** Summary, decisions and action items of one meeting. Used by the analyse result and the meeting page. */
export function MeetingContent({ meeting, onItemChange }: Props) {
  return (
    <div className="content-stack">
      <section className="section" aria-labelledby="summary-heading">
        <h3 id="summary-heading" className="section-title">
          Summary
        </h3>
        {meeting.summary.length > 0 ? (
          <ul className="bullets">
            {meeting.summary.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No summary was produced.</p>
        )}
      </section>

      <section className="section" aria-labelledby="decisions-heading">
        <h3 id="decisions-heading" className="section-title">
          Decisions
        </h3>
        {meeting.decisions.length > 0 ? (
          <ul className="decision-list">
            {meeting.decisions.map((decision, i) => (
              <li key={i}>{decision}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No decisions were recorded.</p>
        )}
      </section>

      <section className="section" aria-labelledby="actions-heading">
        <h3 id="actions-heading" className="section-title">
          Action items
        </h3>
        <ActionItemsTable items={meeting.actionItems} onChange={onItemChange} />
      </section>
    </div>
  );
}
