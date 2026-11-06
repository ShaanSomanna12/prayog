'use client';

/**
 * ConnectionBanner — sticky header bar announcing connectivity state.
 *
 * Shows nothing when connected. Transitions to a slim amber "Reconnecting…"
 * bar when the WebSocket / Supabase channel drops, with a spinner.
 * Shows a solid red bar on full disconnection.
 *
 * Uses aria-live="polite" so screen readers announce the state change without
 * interrupting current content.
 */

import { cn } from '@/lib/utils';
import type { ConnectionState } from '@/types/machine';

interface Props {
  state: ConnectionState;
}

export function ConnectionBanner({ state }: Props) {
  if (state === 'connected') return null;

  const isReconnecting = state === 'reconnecting';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'flex items-center justify-center gap-2',
        'px-4 py-2 text-xs font-mono font-semibold tracking-wide',
        'transition-all duration-300',
        isReconnecting
          ? 'bg-warn text-black'
          : 'bg-danger text-white',
      )}
    >
      {isReconnecting ? (
        <>
          {/* Spinner */}
          <svg
            aria-hidden
            className="animate-spin w-3.5 h-3.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          Reconnecting to Watch Guard backend…
        </>
      ) : (
        <>
          <span aria-hidden>⚠</span>
          Disconnected — data may be stale
        </>
      )}
    </div>
  );
}

