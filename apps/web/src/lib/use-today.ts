'use client';

import { useSyncExternalStore } from 'react';
import { todayLocalIso } from './format';

const subscribe = () => () => undefined;

/**
 * The viewer's local date (YYYY-MM-DD). Prerendered HTML and hydration see null, so no build-time date is baked in.
 * Callers treat null as "unknown" and show nothing as overdue until the client value arrives.
 */
export function useToday(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => todayLocalIso(),
    () => null,
  );
}
