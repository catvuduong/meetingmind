'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SourceBadge } from './badges';
import { MeetingContent } from './meeting-content';
import { EmptyState, ErrorState, ResultSkeleton } from './states';
import { ApiError, api } from '@/lib/api';
import { formatDate, withActionItem } from '@/lib/format';
import type { ActionItem, Meeting } from '@/lib/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; meeting: Meeting }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export function MeetingDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0;

  const [load, setLoad] = useState<LoadState>(validId ? { status: 'loading' } : { status: 'missing' });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!validId) return;
    let active = true;
    api
      .getMeeting(id)
      .then((meeting) => {
        if (active) setLoad({ status: 'ready', meeting });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) setLoad({ status: 'missing' });
        else setLoad({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load this meeting.' });
      });
    return () => {
      active = false;
    };
  }, [id, validId]);

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMeeting(id);
      router.push('/meetings');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete the meeting.');
      setDeleting(false);
    }
  }

  function onItemChange(item: ActionItem) {
    setLoad((current) => (current.status === 'ready' ? { status: 'ready', meeting: withActionItem(current.meeting, item) } : current));
  }

  return (
    <div className="page">
      <Link href="/meetings" className="back-link">
        ← All meetings
      </Link>

      {load.status === 'loading' && <ResultSkeleton />}

      {load.status === 'missing' && (
        <EmptyState
          title="Meeting not found"
          action={
            <Link className="btn btn-primary" href="/meetings">
              Back to meetings
            </Link>
          }
        >
          It may have been deleted, or the link is wrong.
        </EmptyState>
      )}

      {load.status === 'error' && <ErrorState message={load.message} />}

      {load.status === 'ready' && (
        <>
          <header className="page-header">
            <div>
              <h1 className="page-title">{load.meeting.title}</h1>
              <p className="page-subtitle meeting-detail-meta">
                <span>{formatDate(load.meeting.date)}</span>
                <SourceBadge source={load.meeting.source} />
              </p>
            </div>
            <div className="page-actions">
              {confirming ? (
                <div className="confirm-row">
                  <button type="button" className="btn btn-danger" disabled={deleting} onClick={remove}>
                    {deleting ? 'Deleting…' : 'Yes, delete this meeting'}
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={deleting} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>
                  Delete meeting
                </button>
              )}
            </div>
          </header>

          {deleteError && (
            <p className="inline-alert" role="alert">
              {deleteError}
            </p>
          )}

          <div className="card card-body">
            <MeetingContent meeting={load.meeting} onItemChange={onItemChange} />
          </div>

          <details className="card transcript-card">
            <summary className="transcript-summary">Transcript</summary>
            <pre className="transcript">{load.meeting.transcript}</pre>
          </details>
        </>
      )}
    </div>
  );
}
