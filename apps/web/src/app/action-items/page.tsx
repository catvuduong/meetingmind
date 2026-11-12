'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { ApiError, api } from '@/lib/api';
import { formatDate, isOverdue } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import type { BoardItem } from '@/lib/types';

const ALL = 'all';
const UNASSIGNED = 'unassigned';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; items: BoardItem[] }
  | { status: 'error'; message: string };

export default function ActionItemsPage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [owner, setOwner] = useState(ALL);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .listActionItems()
      .then((items) => {
        if (active) setLoad({ status: 'ready', items });
      })
      .catch((err: unknown) => {
        if (active) setLoad({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load action items.' });
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const items = useMemo(() => (load.status === 'ready' ? load.items : []), [load]);

  const owners = useMemo(
    () => [...new Set(items.map((item) => item.owner).filter((name): name is string => name !== null))].sort(),
    [items],
  );

  const today = useToday() ?? '';
  const visible = items.filter((item) => {
    if (owner === ALL) return true;
    if (owner === UNASSIGNED) return item.owner === null;
    return item.owner === owner;
  });
  const open = visible.filter((item) => item.status === 'open');
  const done = visible.filter((item) => item.status === 'done');
  const overdueCount = open.filter((item) => isOverdue(item, today)).length;

  async function toggle(item: BoardItem) {
    setPendingId(item.id);
    setActionError(null);
    try {
      const updated = await api.setActionStatus(item.id, item.status === 'open' ? 'done' : 'open');
      setLoad((current) =>
        current.status === 'ready'
          ? { status: 'ready', items: current.items.map((i) => (i.id === updated.id ? updated : i)) }
          : current,
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update the action item.');
    } finally {
      setPendingId(null);
    }
  }

  function renderCard(item: BoardItem) {
    const isDone = item.status === 'done';
    const overdue = isOverdue(item, today);
    return (
      <li key={item.id} className={`item-card${overdue ? ' is-overdue' : ''}${isDone ? ' is-done' : ''}`}>
        <p className="item-task">{item.task}</p>
        <div className="item-meta">
          <span className="chip">{item.owner ?? 'Unassigned'}</span>
          {item.due ? (
            <span className={overdue ? 'due is-overdue' : 'due'}>
              {overdue ? 'Overdue · ' : 'Due '}
              {formatDate(item.due)}
            </span>
          ) : (
            <span className="muted">No due date</span>
          )}
        </div>
        <div className="item-footer">
          <Link href={`/meetings/${item.meetingId}`} className="item-source">
            {item.meetingTitle}
          </Link>
          <button
            type="button"
            className={isDone ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
            disabled={pendingId === item.id}
            onClick={() => toggle(item)}
          >
            {isDone ? 'Reopen' : 'Mark done'}
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Action items</h1>
          <p className="page-subtitle">Everything committed to across all meetings. Mark items done as they finish.</p>
        </div>
      </header>

      {load.status === 'loading' && <ListSkeleton rows={3} />}

      {load.status === 'error' && (
        <>
          <ErrorState message={load.message} />
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </>
      )}

      {load.status === 'ready' && items.length === 0 && (
        <EmptyState title="No action items yet">
          Analyse a meeting with commitments in it, such as “I’ll send the notes by Friday”, and they will appear here.
        </EmptyState>
      )}

      {load.status === 'ready' && items.length > 0 && (
        <>
          <div className="toolbar">
            <label className="field field-inline">
              <span className="field-label">Owner</span>
              <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value={ALL}>All owners</option>
                <option value={UNASSIGNED}>Unassigned</option>
                {owners.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="chips" aria-live="polite">
              <span className="chip chip-open">{open.length} open</span>
              <span className={overdueCount > 0 ? 'chip chip-overdue' : 'chip'}>{overdueCount} overdue</span>
              <span className="chip chip-done">{done.length} done</span>
            </div>
          </div>

          {actionError && (
            <p className="inline-alert" role="alert">
              {actionError}
            </p>
          )}

          <div className="board">
            <section className="column" aria-labelledby="open-heading">
              <header className="column-header">
                <h2 id="open-heading" className="column-title">
                  Open
                </h2>
                <span className="column-count">{open.length}</span>
              </header>
              {open.length === 0 ? (
                <p className="column-empty">Nothing open for this owner.</p>
              ) : (
                <ul className="item-list">{open.map(renderCard)}</ul>
              )}
            </section>

            <section className="column" aria-labelledby="done-heading">
              <header className="column-header">
                <h2 id="done-heading" className="column-title">
                  Done
                </h2>
                <span className="column-count">{done.length}</span>
              </header>
              {done.length === 0 ? (
                <p className="column-empty">Nothing finished yet.</p>
              ) : (
                <ul className="item-list">{done.map(renderCard)}</ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
