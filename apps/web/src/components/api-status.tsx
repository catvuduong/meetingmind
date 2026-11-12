'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Status = { state: 'checking' } | { state: 'ok'; db: string } | { state: 'down' };

export function ApiStatus() {
  const [status, setStatus] = useState<Status>({ state: 'checking' });

  useEffect(() => {
    let active = true;
    api
      .health()
      .then((health) => {
        if (active) setStatus({ state: 'ok', db: health.db });
      })
      .catch(() => {
        if (active) setStatus({ state: 'down' });
      });
    return () => {
      active = false;
    };
  }, []);

  const label =
    status.state === 'ok'
      ? `api ok · db ${status.db}`
      : status.state === 'down'
        ? 'api unreachable'
        : 'checking…';
  const tone = status.state === 'ok' ? 'is-ok' : status.state === 'down' ? 'is-down' : 'is-checking';

  return (
    <span className="api-status" title="Connection to the MeetingMind API">
      <span className={`dot ${tone}`} aria-hidden="true" />
      <span data-testid="health">{label}</span>
    </span>
  );
}
