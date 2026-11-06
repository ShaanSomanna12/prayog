'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useWebSocket } from './useWebSocket';
import type {
  MachineState,
  MachineAnalysisPayload,
  ConnectionState,
  MachineType,
} from '@/types/machine';

const WS_URL = process.env.NEXT_PUBLIC_WG_WS_URL ?? 'ws://localhost:3001';

function payloadToState(
  payload: MachineAnalysisPayload,
  previous?: MachineState,
): MachineState {
  return {
    id:                 payload.camera_id,
    name:               payload.machine_name ?? `Camera ${payload.camera_id}`,
    type:               (payload.machine_type ?? '3d_printer') as MachineType,
    status:             payload.machine_status,
    statusReason:       payload.machine_status_reason,
    analysisStatus:     payload.status,
    failureType:        payload.failure_type,
    severity:           payload.severity,
    confidence:         payload.confidence,
    confirmationStreak: payload.confirmation_streak,
    confirmationTarget: payload.confirmation_target,
    confirmedFailure:   payload.confirmed_failure,
    acknowledged:       payload.newly_recovered ? false : (previous?.acknowledged ?? false),
    snapshot:           payload.snapshot ?? previous?.snapshot,
    failureBox:         payload.failure_box,
    detectedColors:     payload.detected_colors,
    lastSeen:           new Date(payload.timestamp),
    reason:             payload.reason,
    evidence:           payload.evidence,
    nextStep:           payload.next_step,
  };
}

export function useRealtimeFleet() {
  const [machines,   setMachines]   = useState<Map<string, MachineState>>(new Map());
  const [connection, setConnection] = useState<ConnectionState>('reconnecting');
  const machinesRef = useRef<Map<string, MachineState>>(machines);

  const applyPayload = useCallback((payload: MachineAnalysisPayload) => {
    setMachines((prev) => {
      const next    = new Map(prev);
      const current = next.get(payload.camera_id);
      next.set(payload.camera_id, payloadToState(payload, current));
      machinesRef.current = next;
      return next;
    });
  }, []);

  // ── Determine which transport to use ─────────────────────────────────────
  const supabase     = getSupabaseClient();
  const useSupabase  = Boolean(supabase);

  // ── Supabase Realtime subscription (useEffect for strict-mode safety) ────
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('machine-events', {
        config: { broadcast: { ack: false } },
      })
      // Broadcast transport: used when the backend calls channel.send()
      .on(
        'broadcast',
        { event: 'machine_status' },
        ({ payload }: { payload: MachineAnalysisPayload }) => {
          applyPayload(payload);
        },
      )
      // Postgres CDC transport: used when the backend INSERTs into machine_events
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'machine_events' },
        ({ new: row }: { new: MachineAnalysisPayload }) => {
          applyPayload(row);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED')                          setConnection('connected');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnection('reconnecting');
        if (status === 'CLOSED')                              setConnection('disconnected');
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // applyPayload is stable (useCallback with no deps); supabase is a singleton
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebSocket fallback (disabled when Supabase is active) ────────────────
  useWebSocket({
    url:                WS_URL,
    onMessage:          applyPayload,
    onConnectionChange: setConnection,
    enabled:            !useSupabase,
  });

  // ── Acknowledge actions ───────────────────────────────────────────────────
  const acknowledge = useCallback((id: string) => {
    setMachines((prev) => {
      const next = new Map(prev);
      const m    = next.get(id);
      if (m) next.set(id, { ...m, acknowledged: true });
      return next;
    });
  }, []);

  const acknowledgeAll = useCallback(() => {
    setMachines((prev) => {
      const next = new Map(prev);
      for (const [id, m] of next) {
        if (m.confirmedFailure) next.set(id, { ...m, acknowledged: true });
      }
      return next;
    });
  }, []);

  return { machines, connection, acknowledge, acknowledgeAll };
}
