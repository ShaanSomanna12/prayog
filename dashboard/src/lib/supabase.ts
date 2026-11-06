import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl       = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseUrl  = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Module-level singleton — created once, reused everywhere.
// Returns null when env vars are not set so the app degrades gracefully
// to the direct WebSocket fallback.
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnon) return null;
  if (_client) return _client;

  _client = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      // Dashboard is read-only and runs in the browser — no session persistence needed
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  });

  return _client;
}
