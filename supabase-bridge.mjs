/**
 * supabase-bridge.mjs — Optional Supabase integration for the Watch Guard backend.
 *
 * When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, every analysis result
 * is written to the `machine_events` table (which triggers Realtime to broadcast
 * it to all connected dashboards).
 *
 * When the env vars are absent the module exports a no-op so the rest of the
 * server is unaffected.
 *
 * Usage in server.mjs:
 *   import { pushToSupabase } from './supabase-bridge.mjs';
 *   // ... after building the result payload:
 *   await pushToSupabase(payload);
 */

import { createClient } from '@supabase/supabase-js';

const rawUrl  = (process.env.SUPABASE_URL             ?? '').trim();
const url     = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const svcKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

// Use the service-role key (bypasses RLS) for server-side inserts
const supabase = url && svcKey
  ? createClient(url, svcKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (supabase) {
  console.log('[Supabase] Bridge active — machine events will be persisted and broadcast.');
} else {
  console.log('[Supabase] Bridge inactive (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set).');
}

/**
 * Writes one analysis result to `machine_events`.
 * The INSERT triggers Supabase Realtime → dashboard cards update instantly.
 *
 * @param {object} payload - The normalised result object from the backend
 * @returns {Promise<void>}
 */
export async function pushToSupabase(payload) {
  if (!supabase) return;         // graceful no-op when not configured

  // Strip the base64 snapshot from the DB row — store it in Supabase Storage
  // instead to keep the row small. If SUPABASE_STORAGE_BUCKET is set we upload
  // the image and replace snapshot with the public URL.
  let snapshotValue = payload.snapshot ?? null;

  if (snapshotValue && process.env.SUPABASE_STORAGE_BUCKET) {
    try {
      snapshotValue = await uploadSnapshot(snapshotValue, payload.camera_id, supabase);
    } catch (err) {
      // Non-fatal — fall back to storing the data URL directly
      console.warn('[Supabase] Snapshot upload failed:', err?.message ?? err);
    }
  }

  const row = {
    camera_id:            payload.camera_id,
    machine_name:         payload.machine_name        ?? null,
    machine_type:         payload.machine_type        ?? '3d_printer',
    timestamp:            payload.timestamp           ?? new Date().toISOString(),
    machine_status:       payload.machine_status,
    machine_status_reason: payload.machine_status_reason ?? null,
    status:               payload.status              ?? null,
    status_confidence:    payload.status_confidence   ?? null,
    failure_type:         payload.failure_type        ?? null,
    failure_box:          payload.failure_box         ?? null,
    confidence:           payload.confidence          ?? null,
    severity:             payload.severity            ?? null,
    reason:               payload.reason              ?? null,
    evidence:             payload.evidence            ?? null,
    probable_cause:       payload.probable_cause      ?? null,
    next_step:            payload.next_step           ?? null,
    snapshot:             snapshotValue,
    detected_colors:      payload.detected_colors     ?? [],
    confirmation_streak:  payload.confirmation_streak ?? 0,
    confirmation_target:  payload.confirmation_target ?? 3,
    confirmed_failure:    payload.confirmed_failure   ?? false,
    newly_confirmed:      payload.newly_confirmed     ?? false,
    newly_recovered:      payload.newly_recovered     ?? false,
  };

  const { error } = await supabase.from('machine_events').insert(row);

  if (error) {
    console.error('[Supabase] Insert failed:', error.message);
  }
}

/**
 * Uploads a base64 snapshot to Supabase Storage and returns its public URL.
 * File path: <bucket>/<camera_id>/<timestamp>.jpg
 */
async function uploadSnapshot(dataUrl, cameraId, client) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const path   = `${cameraId}/${Date.now()}.jpg`;

  const { error } = await client.storage
    .from(bucket)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

