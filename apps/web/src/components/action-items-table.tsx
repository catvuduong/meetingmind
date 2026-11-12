'use client';

import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { formatDate, isOverdue } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import type { ActionItem } from '@/lib/types';
import { StatusBadge } from './badges';

interface Props {
  items: ActionItem[];
  /** Called with the server's copy of an item after its status changes. */
  onChange: (item: ActionItem) => void;
}

export function ActionItemsTable({ items, onChange }: Props) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = useToday() ?? '';

  async function toggle(item: ActionItem) {
    setPendingId(item.id);
    setError(null);
    try {
      const updated = await api.setActionStatus(item.id, item.status === 'open' ? 'done' : 'open');
      onChange(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the action item.');
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="muted">No action items were found in this meeting.</p>;
  }

  return (
    <>
      {error && (
        <p className="inline-alert" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table className="table table-stack">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Owner</th>
              <th scope="col">Due</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Change status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const overdue = isOverdue(item, today);
              return (
                <tr key={item.id} className={overdue ? 'is-overdue' : undefined}>
                  <td data-label="Task" className={item.status === 'done' ? 'is-done-text' : undefined}>
                    {item.task}
                  </td>
                  <td data-label="Owner">{item.owner ?? <span className="muted">Unassigned</span>}</td>
                  <td data-label="Due">
                    {item.due ? (
                      <span className="due-cell">
                        {formatDate(item.due)}
                        {overdue && <span className="badge badge-overdue">Overdue</span>}
                      </span>
                    ) : (
                      <span className="muted">No date</span>
                    )}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="cell-action">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={pendingId === item.id}
                      onClick={() => toggle(item)}
                    >
                      {item.status === 'open' ? 'Mark done' : 'Reopen'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
