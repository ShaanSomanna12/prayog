'use client';

/**
 * StatusBadge — semantic status pill with an animated dot.
 *
 * Renders:
 *  - A pulsing dot (animated for active/alert states)
 *  - A concise label
 *
 * Uses only Tailwind utility classes; no inline styles.
 * WCAG contrast: white text on coloured bg ≥ 4.5:1 for all variants.
 */

import { cn, statusColors } from '@/lib/utils';
import type { MachineStatus } from '@/types/machine';

interface Props {
  status: MachineStatus;
  confirmedFailure?: boolean;
  streak?: number;
  target?: number;
  className?: string;
}

const LABEL: Record<MachineStatus, string> = {
  printing:        'Printing',
  idle:            'Idle',
  needs_attention: 'Needs Attention',
};

export function StatusBadge({ status, confirmedFailure, streak = 0, target = 3, className }: Props) {
  const colors    = statusColors(status);
  const isActive  = status === 'printing';
  const isAlert   = status === 'needs_attention';
  const isConfirmed = confirmedFailure && isAlert;

  return (
    <span
      role="status"
      aria-label={`Machine status: ${LABEL[status]}${isConfirmed ? ' (confirmed failure)' : ''}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono font-semibold tracking-wide select-none',
        colors.badge,
        className,
      )}
    >
      {/* Animated status dot */}
      <span className="relative flex h-2 w-2 flex-shrink-0">
        {(isActive || isAlert) && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75',
              isAlert ? 'animate-ping bg-danger' : 'animate-ping bg-ok',
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', colors.dot)} />
      </span>

      {LABEL[status]}

      {/* Streak counter — only shown while building toward confirmation */}
      {isAlert && streak > 0 && !isConfirmed && (
        <span
          aria-label={`${streak} of ${target} confirmation frames`}
          className="ml-0.5 opacity-70"
          title={`${streak}/${target} confirmation frames`}
        >
          {streak}/{target}
        </span>
      )}

      {/* Confirmed failure indicator */}
      {isConfirmed && (
        <span aria-hidden className="ml-0.5 text-danger font-bold">!</span>
      )}
    </span>
  );
}

