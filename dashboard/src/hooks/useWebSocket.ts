'use client';

/**
 * useWebSocket — direct WebSocket connection to the Watch Guard backend.
 *
 * This is the FALLBACK transport used when Supabase is not configured.
 * The backend broadcasts the same JSON payload over ws:// that it also
 * writes to Supabase, so both transports deliver identical data shapes.
 *
 * Features:
 *  - Exponential back-off reconnect (max 30 s)
 *  - "Reconnecting" UI state surfaced to callers
 *  - Pauses reconnect when the tab is hidden (Page Visibility API)
 *  - Calls onMessage with the parsed MachineAnalysisPayload
 */

import { useEffect, useRef, useCallback } from 'react';
import type { MachineAnalysisPayload, ConnectionState } from '@/types/machine';

interface Options {
  url: string;
  onMessage: (payload: MachineAnalysisPayload) => void;
  onConnectionChange: (state: ConnectionState) => void;
  enabled?: boolean;
}

const BASE_DELAY_MS  = 1_000;
const MAX_DELAY_MS   = 30_000;
const BACKOFF_FACTOR = 1.6;

export function useWebSocket({ url, onMessage, onConnectionChange, enabled = true }: Options) {
  const wsRef        = useRef<WebSocket | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef   = useRef(0);
  const unmountedRef = useRef(false);

  const clearRetry = () => {
    if (retryRef.current !== null) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (unmountedRef.current || !enabled) return;
    if (document.hidden) {
      // Defer until the tab is visible
      const resume = () => { document.removeEventListener('visibilitychange', resume); connect(); };
      document.addEventListener('visibilitychange', resume);
      return;
    }

    onConnectionChange(attemptRef.current === 0 ? 'connected' : 'reconnecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      attemptRef.current = 0;
      onConnectionChange('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        // The backend wraps many event types; we only care about analysis results
        if (data?.camera_id && data?.machine_status) {
          onMessage(data as MachineAnalysisPayload);
        }
      } catch {
        // Silently drop non-JSON frames
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      onConnectionChange('reconnecting');
      const delay = Math.min(
        BASE_DELAY_MS * Math.pow(BACKOFF_FACTOR, attemptRef.current),
        MAX_DELAY_MS,
      );
      attemptRef.current++;
      retryRef.current = setTimeout(connect, delay);
    };
  }, [url, onMessage, onConnectionChange, enabled]);

  useEffect(() => {
    unmountedRef.current = false;
    if (!enabled) return;
    connect();

    const handleVisibility = () => {
      if (!document.hidden && wsRef.current?.readyState === WebSocket.CLOSED) {
        clearRetry();
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unmountedRef.current = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      clearRetry();
      wsRef.current?.close();
    };
  }, [connect, enabled]);
}

