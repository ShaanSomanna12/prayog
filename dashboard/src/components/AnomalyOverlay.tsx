'use client';

/**
 * AnomalyOverlay — renders a camera snapshot with a programmatic SVG
 * bounding box drawn over the detected failure region.
 *
 * The failure_box coordinates are fractional (0–1) relative to the image
 * dimensions, so they scale correctly regardless of the rendered size.
 *
 * Accessibility: the SVG carries aria-hidden; the surrounding <figure> has
 * an accessible description of the detected failure.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import type { BoundingBox, DetectedColor } from '@/types/machine';
import { failureLabel, cn } from '@/lib/utils';

interface Props {
  snapshot: string;          // base64 data URL
  box: BoundingBox;
  failureType: string;
  severity: number;
  detectedColors?: DetectedColor[];
  className?: string;
  onClose?: () => void;
}

/** Severity → stroke colour */
function boxColor(severity: number): string {
  if (severity >= 7) return '#ef4444';   // danger red
  if (severity >= 4) return '#f59e0b';   // amber
  return '#38bdf8';                      // sky blue (low severity)
}

export function AnomalyOverlay({
  snapshot,
  box,
  failureType,
  severity,
  detectedColors = [],
  className,
  onClose,
}: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const imgRef      = useRef<HTMLImageElement | null>(null);
  const hasBox      = box.width > 0.01 && box.height > 0.01;
  const strokeColor = boxColor(severity);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || !hasBox) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { naturalWidth: nw, naturalHeight: nh } = img;
    canvas.width  = nw;
    canvas.height = nh;

    ctx.clearRect(0, 0, nw, nh);

    const x = box.x * nw;
    const y = box.y * nh;
    const w = box.width  * nw;
    const h = box.height * nh;

    // ── Darkened vignette outside the box ──────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, nw, nh);
    ctx.clearRect(x, y, w, h);

    // ── Box stroke ─────────────────────────────────────────────────────────
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = Math.max(2, Math.round(nw / 180));
    ctx.strokeRect(x, y, w, h);

    // ── Corner accents ─────────────────────────────────────────────────────
    const cl = Math.min(w, h) * 0.22;
    ctx.lineWidth = ctx.lineWidth * 1.8;
    ctx.beginPath();
    // top-left
    ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y);
    // top-right
    ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl);
    // bottom-right
    ctx.moveTo(x + w, y + h - cl); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cl, y + h);
    // bottom-left
    ctx.moveTo(x + cl, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cl);
    ctx.stroke();

    // ── Label tag ──────────────────────────────────────────────────────────
    const label   = failureLabel(failureType) || 'Anomaly';
    const tagH    = Math.round(nw / 24);
    const fontSize = Math.max(10, tagH * 0.6);

    ctx.font      = `700 ${fontSize}px ui-monospace, monospace`;
    const textW   = ctx.measureText(label).width;
    const tagW    = textW + fontSize * 1.4;
    const tagX    = x;
    const tagY    = y - tagH - 4 < 0 ? y + 4 : y - tagH - 4;

    ctx.fillStyle = strokeColor;
    ctx.fillRect(tagX, tagY, tagW, tagH);

    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, tagX + fontSize * 0.7, tagY + tagH / 2);
  }, [box, failureType, hasBox, strokeColor]);

  // Load image and draw once it's ready
  useEffect(() => {
    const img   = new Image();
    imgRef.current = img;
    img.onload  = drawOverlay;
    img.src     = snapshot;
    return () => { img.onload = null; };
  }, [snapshot, drawOverlay]);

  // Re-draw when box / failure changes
  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  // Close on Escape
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const label = failureLabel(failureType) || 'Detected anomaly';

  return (
    <figure
      className={cn('relative overflow-hidden rounded-lg bg-black', className)}
      aria-label={`Anomaly snapshot: ${label}, severity ${severity}/10`}
    >
      {/* Base image */}
      <img
        src={snapshot}
        alt={`Camera snapshot — ${label}`}
        className="block w-full h-auto"
        draggable={false}
      />

      {/* Canvas overlay — only shown when there is a valid box */}
      {hasBox && (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'contain' }}
        />
      )}

      {/* Meta strip at the bottom */}
      <figcaption className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 px-3 py-2 bg-black/70 backdrop-blur-sm text-xs font-mono">
        <span className="text-white font-semibold tracking-wide">{label}</span>
        <span
          className={cn(
            'px-2 py-0.5 rounded font-bold tracking-widest text-[10px]',
            severity >= 7 ? 'bg-danger text-white' :
            severity >= 4 ? 'bg-warn text-black' :
            'bg-idle text-black',
          )}
        >
          SEV {severity}/10
        </span>

        {detectedColors.length > 0 && (
          <div className="flex items-center gap-1.5" aria-label="Detected filament colours">
            {detectedColors.slice(0, 4).map((c) => (
              <span
                key={c.hex}
                title={`${c.name} (${Math.round(c.coverage * 100)}%)`}
                style={{ background: c.hex }}
                className="w-3 h-3 rounded-full border border-white/30 flex-shrink-0"
              />
            ))}
          </div>
        )}

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close anomaly view"
            className="ml-auto text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </figcaption>
    </figure>
  );
}

