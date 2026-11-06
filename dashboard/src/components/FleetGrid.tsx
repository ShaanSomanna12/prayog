'use client';

/**
 * FleetGrid — responsive CSS Grid container for MachineCard components.
 *
 * Tailwind grid: 1 col mobile → 2 cols tablet → 3 cols desktop → 4 cols wide.
 * Cards with confirmed failures are sorted to the top of the grid automatically.
 *
 * Empty / loading states are handled inline rather than delegated to children,
 * so the grid always occupies its minimum height and no layout shift occurs
 * when the first payload arrives.
 */

import React, { useMemo } from 'react';
import type { MachineState } from '@/types/machine';
import { MachineCard } from './MachineCard';
import { cn } from '@/lib/utils';

interface Props {
  machines: Map<string, MachineState>;
  onAcknowledge: (id: string) => void;
  className?: string;
}

/** Sort order: confirmed > needs_attention > printing > idle */
function sortPriority(m: MachineState): number {
  if (m.confirmedFailure && !m.acknowledged) return 0;
  if (m.status === 'needs_attention')         return 1;
  if (m.status === 'printing')                return 2;
  return 3;
}

export function FleetGrid({ machines, onAcknowledge, className }: Props) {
  const sorted = useMemo(() => {
    const list = Array.from(machines.values());
    list.sort((a, b) => sortPriority(a) - sortPriority(b) || a.name.localeCompare(b.name));
    return list;
  }, [machines]);

  if (sorted.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center gap-4 py-24 text-ink-3"
      >
        {/* Spinner */}
        <svg className="animate-spin w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
        <p className="text-sm font-mono">Waiting for machine data…</p>
        <p className="text-xs opacity-60">Ensure the Watch Guard backend is running on port 3001</p>
      </div>
    );
  }

  return (
    <section
      aria-label={`Fleet — ${sorted.length} machine${sorted.length !== 1 ? 's' : ''}`}
      className={cn(
        // ── Responsive grid ──────────────────────────────────────────────
        // 1 col  < 480 px   (mobile portrait)
        // 2 cols ≥ 480 px   (mobile landscape / small tablet)
        // 3 cols ≥ 768 px   (tablet)
        // 4 cols ≥ 1280 px  (desktop)
        'grid gap-4',
        'grid-cols-1',
        'min-[480px]:grid-cols-2',
        'md:grid-cols-3',
        'xl:grid-cols-4',
        className,
      )}
    >
      {sorted.map((machine) => (
        <MachineCard
          key={machine.id}
          machine={machine}
          onAcknowledge={onAcknowledge}
        />
      ))}
    </section>
  );
}

