'use client';

/**
 * SummaryBar — a compact row of fleet-wide counts shown below the page header.
 *
 * Counts: Total | Printing | Idle | Needs Attention | Confirmed Failures
 *
 * When there are unacknowledged confirmed failures the count badge pulses.
 * The "Acknowledge all" action is surfaced here for efficiency (one click
 * rather than hunting down each flashing card).
 */

import { cn } from '@/lib/utils';
import type { FleetSummary } from '@/types/machine';

interface Props {
  summary: FleetSummary;
  onAcknowledgeAll: () => void;
}

interface StatProps {
  label: string;
  value: number;
  colorClass?: string;
  pulse?: boolean;
}

function Stat({ label, value, colorClass = 'text-ink', pulse }: StatProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[56px]">
      <span
        className={cn(
          'text-2xl font-bold font-mono tabular-nums leading-none',
          colorClass,
          pulse && value > 0 && 'animate-pulse',
        )}
      >
        {value}
      </span>
      <span className="text-[10px] font-mono text-ink-3 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

export function SummaryBar({ summary, onAcknowledgeAll }: Props) {
  const hasConfirmed = summary.confirmed > 0;

  return (
    <section
      aria-label="Fleet summary"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-3',
        'px-5 py-3 rounded-xl border bg-surface',
        hasConfirmed ? 'border-danger/30' : 'border-rim',
      )}
    >
      {/* Stats row */}
      <div className="flex items-center gap-6 divide-x divide-rim">
        <Stat label="Total"     value={summary.total}         colorClass="text-ink" />
        <div className="pl-6">
          <Stat label="Printing"  value={summary.printing}      colorClass="text-ok" />
        </div>
        <div className="pl-6">
          <Stat label="Idle"      value={summary.idle}          colorClass="text-idle" />
        </div>
        <div className="pl-6">
          <Stat
            label="Attention"
            value={summary.needsAttention}
            colorClass={summary.needsAttention > 0 ? 'text-warn' : 'text-ink-3'}
          />
        </div>
        {hasConfirmed && (
          <div className="pl-6">
            <Stat
              label="Confirmed"
              value={summary.confirmed}
              colorClass="text-danger"
              pulse
            />
          </div>
        )}
      </div>

      {/* Acknowledge all */}
      {hasConfirmed && (
        <button
          onClick={onAcknowledgeAll}
          aria-label={`Acknowledge all ${summary.confirmed} confirmed failure alerts`}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
            'border border-danger/30 bg-danger-dim text-danger',
            'hover:bg-danger hover:text-white hover:border-danger',
            'transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger',
          )}
        >
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          Acknowledge all ({summary.confirmed})
        </button>
      )}
    </section>
  );
}

