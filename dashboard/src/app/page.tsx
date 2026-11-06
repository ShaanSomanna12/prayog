'use client';

/**
 * Mission Control page — the fleet dashboard root.
 *
 * Hierarchy:
 *   ConnectionBanner  (fixed, top — only visible when not connected)
 *   <header>          (branding + live clock)
 *   <main>
 *     SummaryBar      (fleet totals + acknowledge-all)
 *     FleetGrid       (responsive grid of MachineCards)
 *
 * Data flows top-down from useRealtimeFleet → FleetGrid → MachineCard.
 * No prop drilling beyond one level; each card receives only its own slice.
 */

import { useMemo, useState, useEffect } from 'react';
import { useRealtimeFleet } from '@/hooks/useRealtimeFleet';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { SummaryBar } from '@/components/SummaryBar';
import { FleetGrid } from '@/components/FleetGrid';
import { computeSummary } from '@/lib/utils';

// ── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!time) return null;
  return (
    <time
      dateTime={new Date().toISOString()}
      className="font-mono text-xs text-ink-3 tabular-nums"
      aria-label="Current time"
    >
      {time}
    </time>
  );
}

// ── Watch Guard logo mark (inline SVG, no external asset needed) ──────────────

function LogoMark() {
  return (
    <svg
      aria-hidden
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield */}
      <path
        d="M16 3L4 8v8c0 6.627 5.373 13 12 15 6.627-2 12-8.373 12-15V8L16 3z"
        fill="rgba(59,130,246,0.15)"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Eye */}
      <ellipse cx="16" cy="16" rx="4" ry="2.5" stroke="#3b82f6" strokeWidth="1.5"/>
      <circle cx="16" cy="16" r="1.5" fill="#3b82f6"/>
    </svg>
  );
}

// ── Connection dot ────────────────────────────────────────────────────────────

function ConnectionDot({ state }: { state: 'connected' | 'reconnecting' | 'disconnected' }) {
  const color =
    state === 'connected'    ? 'bg-ok' :
    state === 'reconnecting' ? 'bg-warn' :
    'bg-danger';
  const label =
    state === 'connected'    ? 'Live' :
    state === 'reconnecting' ? 'Reconnecting' :
    'Disconnected';

  return (
    <div className="flex items-center gap-1.5 select-none" aria-label={`Connection status: ${label}`}>
      <span className="relative flex h-2 w-2">
        {state === 'connected' && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-75 animate-ping" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
      </span>
      <span className="text-[11px] font-mono text-ink-3">{label}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const { machines, connection, acknowledge, acknowledgeAll } = useRealtimeFleet();
  const summary = useMemo(() => computeSummary(machines), [machines]);

  return (
    <>
      {/* Connectivity banner (only shown when not connected) */}
      <ConnectionBanner state={connection} />

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b border-rim bg-surface/90 backdrop-blur-md"
        role="banner"
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <LogoMark />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-ink leading-tight truncate">
                Watch Guard
              </h1>
              <p className="text-[10px] font-mono text-ink-3 tracking-widest uppercase leading-tight">
                Mission Control
              </p>
            </div>
          </div>

          {/* Right: clock + connection */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <LiveClock />
            <ConnectionDot state={connection} />
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main
        id="main-content"
        className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-5"
        aria-label="Fleet dashboard"
      >
        {/* Summary row */}
        <SummaryBar summary={summary} onAcknowledgeAll={acknowledgeAll} />

        {/* Fleet grid */}
        <FleetGrid
          machines={machines}
          onAcknowledge={acknowledge}
        />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="max-w-[1600px] mx-auto px-4 sm:px-6 pb-8 text-[10px] font-mono text-ink-3 flex items-center justify-between gap-4 flex-wrap">
        <span>Watch Guard · University Lab Fleet Monitor</span>
        <span>AI: Groq · Vision: qwen/qwen3.8-27b</span>
      </footer>
    </>
  );
}

