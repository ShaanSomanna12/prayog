import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { MachineStatus, FleetSummary, MachineState } from '@/types/machine';

/** Merge Tailwind classes safely (via clsx + tailwind-merge) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable elapsed time, e.g. "just now", "2 m ago" */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/** Tailwind colour tokens per machine status */
export function statusColors(status: MachineStatus) {
  switch (status) {
    case 'printing':
      return {
        dot:    'bg-ok',
        badge:  'bg-ok-dim text-ok border-ok/30',
        card:   'border-ok/20',
        glow:   'shadow-[0_0_0_1px_rgba(34,197,94,0.15)]',
      };
    case 'idle':
      return {
        dot:    'bg-idle',
        badge:  'bg-idle-dim text-idle border-idle/30',
        card:   'border-idle/20',
        glow:   'shadow-[0_0_0_1px_rgba(56,189,248,0.15)]',
      };
    case 'needs_attention':
      return {
        dot:    'bg-danger',
        badge:  'bg-danger-dim text-danger border-danger/30',
        card:   'border-danger/40',
        glow:   'shadow-[0_0_0_1px_rgba(239,68,68,0.3)]',
      };
  }
}

/** Human label for machine_type */
export function machineTypeLabel(type: string): string {
  const map: Record<string, string> = {
    '3d_printer':   '3D Printer',
    'laser_cutter': 'Laser Cutter',
    'cnc':          'CNC Router',
  };
  return map[type] ?? type;
}

/** Human label for failure_type */
export function failureLabel(type: string): string {
  if (!type || type === 'none') return '';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Compute fleet summary counts from the machine map */
export function computeSummary(machines: Map<string, MachineState>): FleetSummary {
  let printing = 0, idle = 0, needsAttention = 0, confirmed = 0;
  for (const m of machines.values()) {
    if (m.status === 'printing') printing++;
    else if (m.status === 'idle') idle++;
    else needsAttention++;
    if (m.confirmedFailure && !m.acknowledged) confirmed++;
  }
  return { total: machines.size, printing, idle, needsAttention, confirmed };
}

