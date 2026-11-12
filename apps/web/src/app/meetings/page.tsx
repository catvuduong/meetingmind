'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SourceBadge } from '@/components/badges';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { ApiError, api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { MeetingSummary } from '@/lib/types';

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; meetings: MeetingSummary[] }
  | { status: 'error'; message: string };

export default function MeetingsPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Wait for typing to pause before searching.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    api
      .listMeetings(search)
      .then((meetings) => {
        if (active) setList({ status: 'ready', meetings });
      })
      .catch((err: unknown) => {
        if (active) {
          setList({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load meetings.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [search, reloadKey]);

  async function remove(id: number) {
    setDeletingId(id);
    setActionError(null);
    try {
      await api.deleteMeeting(id);
      setList((current) =>
        current.status === 'ready'
          ? { status: 'ready', meetings: current.meetings.filter((m) => m.id !== id) }
          : current,
      );
      setConfirmingId(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete the meeting.');
    } finally {
      setDeletingId(null);
    }
  }

  const meetings = list.status === 'ready' ? list.meetings : [];
  const searching = search.length > 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-subtitle">Every analysed meeting, newest first. Search titles, summaries and action items.</p>
        </div>
      </header>

      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Search meetings</span>
          <input
            type="search"
            className="input"
            placeholder="Search titles, summaries and action items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {list.status === 'ready' && (
          <span className="muted toolbar-count" aria-live="polite">
            {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'}
          </span>
        )}
      </div>

      {actionError && (
        <p className="inline-alert" role="alert">
          {actionError}
        </p>
      )}

      {list.status === 'loading' && <ListSkeleton rows={4} />}

      {list.status === 'error' && (
        <ErrorState message={list.message} />
      )}

      {list.status === 'error' && (
        <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
          Try again
        </button>
      )}

      {list.status === 'ready' && meetings.length === 0 && !searching && (
        <EmptyState
          title="No meetings yet"
          action={
            <Link className="btn btn-primary" href="/">
              Analyse your first meeting
            </Link>
          }
        >
          Paste a transcript on the Analyse page and it will be saved here.
        </EmptyState>
      )}

      {list.status === 'ready' && meetings.length === 0 && searching && (
        <EmptyState title={`No meetings match “${search}”`}>
          Try a different word, or search for a person’s name or a due date phrase.
        </EmptyState>
      )}

      {list.status === 'ready' && meetings.length > 0 && (
        <ul className="meeting-list" aria-busy={query !== search}>
          {meetings.map((meeting) => (
            <li key={meeting.id} className="meeting-card" data-testid="meeting-row">
              <div className="meeting-main">
                <div className="meeting-heading">
                  <Link href={`/meetings/${meeting.id}`} className="meeting-title">
                    {meeting.title}
                  </Link>
                  <SourceBadge source={meeting.source} />
                </div>
                <p className="meeting-meta">{formatDate(meeting.date)}</p>
                {meeting.summary[0] && <p className="meeting-summary">{meeting.summary[0]}</p>}
              </div>

              <div className="meeting-side">
                <span className={meeting.openCount > 0 ? 'badge badge-count' : 'badge badge-done'}>
                  {meeting.openCount > 0
                    ? `${meeting.openCount} open ${meeting.openCount === 1 ? 'action' : 'actions'}`
                    : meeting.totalCount > 0
                      ? 'All done'
                      : 'No actions'}
                </span>

                {confirmingId === meeting.id ? (
                  <div className="confirm-row">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={deletingId === meeting.id}
                      onClick={() => remove(meeting.id)}
                    >
                      {deletingId === meeting.id ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmingId(meeting.id)}
                    aria-label={`Delete ${meeting.title}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
