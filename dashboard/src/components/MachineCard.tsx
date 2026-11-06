'use client';

/**
 * MachineCard — real-time status card for one machine in the fleet grid.
 *
 * Visual states:
 *  - Normal (printing / idle)       → clean bordered card
 *  - needs_attention (streak < target) → warning border, amber accent
 *  - confirmed_failure               → flashing red border (animation: card-flash)
 *  - acknowledged                   → muted red, no flash (operator saw it)
 *
 * Clicking the card when a snapshot is available opens the AnomalyOverlay
 * in a dialog. The Acknowledge button clears the flash without dismissing
 * the data.
 *
 * Performance: uses CSS animations instead of JS intervals; no layout
 * shift from status updates (all space is pre-reserved).
 */

import React, { useState, useCallback } from 'react';
import type { MachineState } from '@/types/machine';
import { StatusBadge } from './StatusBadge';
import { AnomalyOverlay } from './AnomalyOverlay';
import { cn, timeAgo, machineTypeLabel, failureLabel, statusColors } from '@/lib/utils';

interface Props {
  machine: MachineState;
  onAcknowledge: (id: string) => void;
}

// ── Icon for machine type ────────────────────────────────────────────────────

function MachineTypeIcon({ type }: { type: string }) {
  if (type === 'laser_cutter') return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
  if (type === 'cnc') return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  );
  // 3d_printer (default)
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 9V3a1 1 0 011-1h10a1 1 0 011 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>
    </svg>
  );
}

// ── Progress bar for severity ────────────────────────────────────────────────

function SeverityBar({ value }: { value: number }) {
  const pct    = Math.round(value * 10);
  const color  = value >= 7 ? 'bg-danger' : value >= 4 ? 'bg-warn' : 'bg-ok';
  return (
    <div className="flex items-center gap-2" aria-label={`Severity ${value} out of 10`}>
      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-ink-3 w-6 text-right">{value}/10</span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MachineCard({ machine, onAcknowledge }: Props) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const {
    id, name, type, status, confirmedFailure, acknowledged,
    confirmationStreak, confirmationTarget,
    snapshot, failureBox, failureType, severity, confidence,
    detectedColors, lastSeen, reason, nextStep,
  } = machine;

  const colors      = statusColors(status);
  const isAlert     = status === 'needs_attention';
  const isConfirmed = confirmedFailure && !acknowledged;
  const hasAnomaly  = isAlert && Boolean(snapshot);

  const handleAcknowledge = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAcknowledge(id);
  }, [id, onAcknowledge]);

  const openOverlay = useCallback(() => {
    if (hasAnomaly) setOverlayOpen(true);
  }, [hasAnomaly]);

  return (
    <>
      {/* ── Card ───────────────────────────────────────────────────────── */}
      <article
        onClick={openOverlay}
        role={hasAnomaly ? 'button' : undefined}
        tabIndex={hasAnomaly ? 0 : undefined}
        onKeyDown={hasAnomaly ? (e) => { if (e.key === 'Enter' || e.key === ' ') openOverlay(); } : undefined}
        aria-label={`${name} — ${status}${confirmedFailure ? ', confirmed failure' : ''}`}
        className={cn(
          // Base card
          'relative flex flex-col gap-3 p-4 rounded-xl border bg-surface',
          'transition-all duration-300 ease-out',
          // Status-aware border colour
          colors.card,
          // Confirmed failure flash (overrides border via animation)
          isConfirmed && 'animate-card-flash',
          // Acknowledged: muted, no flash
          acknowledged && isAlert && 'border-danger/20 opacity-80',
          // Interactive cursor when snapshot is available
          hasAnomaly && 'cursor-pointer hover:bg-elevated',
          'outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
          'animate-fade-up',
        )}
      >
        {/* ── Confirmed alert bar ──────────────────────────────────────── */}
        {isConfirmed && (
          <div
            aria-live="assertive"
            className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-danger animate-pulse"
          />
        )}

        {/* ── Header row ───────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-ink-3 text-[10px] font-mono uppercase tracking-widest mb-1">
              <MachineTypeIcon type={type} />
              <span>{machineTypeLabel(type)}</span>
            </div>
            <h2 className="text-sm font-semibold text-ink truncate leading-tight">{name}</h2>
            <p className="text-[10px] text-ink-3 font-mono mt-0.5">{timeAgo(lastSeen)}</p>
          </div>

          <StatusBadge
            status={status}
            confirmedFailure={confirmedFailure}
            streak={confirmationStreak}
            target={confirmationTarget}
            className="flex-shrink-0"
          />
        </header>

        {/* ── Snapshot thumbnail (when available) ──────────────────────── */}
        {snapshot && (
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <img
              src={snapshot}
              alt={`Camera snapshot for ${name}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {isAlert && (
              <div className="absolute inset-0 ring-1 ring-inset ring-danger/40 rounded-lg" />
            )}
            {hasAnomaly && (
              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[9px] text-white/70 font-mono">
                Click to inspect
              </div>
            )}
          </div>
        )}

        {/* ── Failure details ───────────────────────────────────────────── */}
        {isAlert && failureType && failureType !== 'none' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-ink-3 uppercase tracking-wider">Failure</span>
              <span className="px-1.5 py-0.5 bg-danger-dim text-danger border border-danger/20 rounded text-[10px] font-mono font-semibold">
                {failureLabel(failureType)}
              </span>
            </div>

            <SeverityBar value={severity} />

            {reason && (
              <p className="text-xs text-ink-2 leading-relaxed line-clamp-2">{reason}</p>
            )}

            {nextStep && (
              <div className="flex items-start gap-1.5 text-xs text-warn">
                <span aria-hidden className="mt-0.5 flex-shrink-0">→</span>
                <span className="line-clamp-2">{nextStep}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Colour swatches (printing state) ─────────────────────────── */}
        {status === 'printing' && detectedColors.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-ink-3 uppercase tracking-wider">Filament</span>
            <div className="flex gap-1.5">
              {detectedColors.slice(0, 4).map((c) => (
                <span
                  key={c.hex}
                  title={`${c.name} (${Math.round(c.coverage * 100)}%)`}
                  style={{ background: c.hex }}
                  className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
                  aria-label={`${c.name} filament colour`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Confidence strip ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-[10px] font-mono text-ink-3 border-t border-rim pt-2 mt-auto">
          <span>Confidence</span>
          <span className="text-ink-2">{Math.round(confidence * 100)}%</span>
        </div>

        {/* ── Acknowledge button ─────────────────────────────────────────── */}
        {isConfirmed && (
          <button
            onClick={handleAcknowledge}
            aria-label={`Acknowledge alert for ${name}`}
            className={cn(
              'w-full text-xs font-mono font-semibold py-2 px-3 rounded-lg border',
              'bg-danger-dim text-danger border-danger/30',
              'hover:bg-danger hover:text-white hover:border-danger',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger',
            )}
          >
            Acknowledge Alert
          </button>
        )}
      </article>

      {/* ── Anomaly overlay dialog ─────────────────────────────────────── */}
      {overlayOpen && snapshot && (
        <div
          role="dialog"
          aria-modal
          aria-label={`Anomaly detail — ${name}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setOverlayOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl overflow-hidden border border-rim-strong bg-surface shadow-2xl animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog header */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-rim">
              <div>
                <h3 className="text-sm font-semibold text-ink">{name}</h3>
                <p className="text-[11px] text-ink-3 font-mono">{failureLabel(failureType)} · {timeAgo(lastSeen)}</p>
              </div>
              <button
                onClick={() => setOverlayOpen(false)}
                aria-label="Close anomaly detail"
                className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Overlay canvas */}
            <AnomalyOverlay
              snapshot={snapshot}
              box={failureBox}
              failureType={failureType}
              severity={severity}
              detectedColors={detectedColors}
            />

            {/* Evidence text */}
            {machine.evidence && (
              <div className="px-5 py-3 border-t border-rim bg-elevated text-xs text-ink-2 leading-relaxed">
                <span className="font-mono font-semibold text-ink-3 uppercase tracking-wider mr-2">Evidence:</span>
                {machine.evidence}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

