/**
 * cascade-orchestrator.mjs — Phase 4: Hybrid Cascade Inference Pipeline Orchestrator.
 *
 * Implements the edge-to-cloud triage pipeline:
 * 1. Fast local triage: Routes frames to the FastAPI YOLO server (http://localhost:8000/analyze).
 * 2. Conditional termination: Discards healthy frames (status: "nominal") to conserve compute/tokens.
 * 3. Concurrent hardware mitigation: Asynchronously fires printer pause & alerts on failure.
 * 4. Cloud forensic escalation: Calls Groq Vision (llama-3.2-11b-vision-preview or configured model)
 *    only for confirmed visual anomalies.
 */

import 'dotenv/config';
import Groq from 'groq-sdk';
import { dispatchFailureAlert, incidentManager } from './sms-service.mjs';
import { notifyFailure } from './notifications.mjs';

// Configuration
const EDGE_INFERENCE_URL = process.env.EDGE_INFERENCE_URL || 'http://localhost:8000/analyze';
const groqApiKey = (process.env.GROQ_API_KEY || '').trim();
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
const CLOUD_VISION_MODEL = process.env.GROQ_MODEL || 'llama-3.2-11b-vision-preview';
const PRINTER_IP = process.env.PRINTER_IP || process.env.OCTOPRINT_URL || '';
const OCTOPRINT_API_KEY = process.env.OCTOPRINT_API_KEY || '';

/**
 * Injects an idempotent hardware pause command via the OctoPrint REST API
 */
export async function triggerOctoPrintPause() {
  if (!PRINTER_IP || !OCTOPRINT_API_KEY) {
    console.warn('[OctoPrint] PRINTER_IP or OCTOPRINT_API_KEY is not configured.');
    return { ok: false, skipped: true };
  }

  const baseUrl = PRINTER_IP.startsWith('http://') || PRINTER_IP.startsWith('https://')
    ? PRINTER_IP
    : `http://${PRINTER_IP}`;

  const url = `${baseUrl.replace(/\/$/, '')}/api/job`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': OCTOPRINT_API_KEY,
    },
    body: JSON.stringify({
      command: 'pause',
      action: 'pause', // Enforces idempotency to prevent accidental toggling
    }),
  });

  if (response.status === 204 || response.ok) {
    console.log('[OctoPrint] Successfully halted the G-code stream.');
    return { ok: true, status: response.status };
  } else {
    throw new Error(`OctoPrint pause command rejected with status: ${response.status}`);
  }
}

/**
 * Checks the local edge inference server.
 * Returns null if the edge server is offline.
 *
 * @param {string} frameBase64 - Raw base64 frame string or data URL
 * @returns {Promise<{ status: string, highest_confidence: number, detections: Array } | null>}
 */
export async function queryEdgeInference(frameBase64) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5s edge timeout (allows cold-start model warmup)

    const res = await fetch(EDGE_INFERENCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: frameBase64 }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Edge server offline or not running yet; gracefully return null to trigger cloud fallback
    return null;
  }
}

/**
 * Invokes the Groq Vision API for deep forensic incident analysis.
 *
 * @param {string} frameDataUrl - Base64 data URL
 * @returns {Promise<string>}
 */
export async function generateGroqIncidentReport(frameDataUrl) {
  if (!groq) {
    throw new Error('Groq client not configured. Set GROQ_API_KEY in .env.');
  }

  const prompt = `You are an expert additive manufacturing diagnostic AI. A local edge computer vision model has detected a critical print failure (e.g., severe stringing, spaghetti, or adhesion loss) in the attached image.
Analyze the visual evidence and generate a concise forensic incident report detailing:
1. The visual severity and morphological characteristics of the failure.
2. Potential root causes (e.g., poor bed adhesion, partial nozzle clog, improper Z-offset, thermal runaway).
3. Actionable remediation steps the operator must take before restarting the g-code execution. Keep it concise.`;

  const cleanUrl = frameDataUrl.startsWith('data:image/')
    ? frameDataUrl
    : `data:image/jpeg;base64,${frameDataUrl}`;

  const completion = await groq.chat.completions.create({
    model: CLOUD_VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: cleanUrl } },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.1, // Low temperature for deterministic forensic output
  });

  return completion.choices[0]?.message?.content || 'No incident report generated.';
}

/**
 * Orchestrates the Hybrid Cascade Inference Pipeline for incoming frames.
 *
 * @param {Object} options
 * @param {string} options.frameBase64 - Webcam frame
 * @param {string} [options.cameraId]
 * @param {string} [options.cameraLabel]
 * @param {Function} [options.pausePrinterFn]
 * @returns {Promise<Object>}
 */
export async function cascadeAnalysis({
  frameBase64,
  cameraId = 'default',
  cameraLabel = 'Camera 1',
  pausePrinterFn = null,
}) {
  // ── PHASE 1: LOCAL EDGE TRIAGE ──────────────────────────────────────────
  const edgeData = await queryEdgeInference(frameBase64);

  if (edgeData) {
    // Conditional Termination: If nominal, halt pipeline to preserve tokens & latency
    if (edgeData.status === 'nominal') {
      return {
        status: 'nominal',
        edge_triaged: true,
        highest_confidence: edgeData.highest_confidence,
        detections: edgeData.detections || [],
        message: 'Fabrication proceeding nominally (Edge YOLO triage).',
      };
    }

    console.log(`[ALERT] Anomaly Detected. Edge Confidence: ${edgeData.highest_confidence}`);

    // ── PHASE 2: CONCURRENT HARDWARE MITIGATION ───────────────────────────
    if (typeof pausePrinterFn === 'function') {
      pausePrinterFn().catch((err) => console.error('[Hardware Pause Failed]:', err));
    }

    // Arm automated WhatsApp incident alert & recurring reminder loop
    incidentManager.recordFailure({
      cameraId,
      cameraLabel,
      failureType: edgeData.detections?.[0]?.class_name || 'spaghetti',
      severity: Math.round((edgeData.highest_confidence || 0.8) * 10),
      reason: 'Local edge YOLO model flagged severe anomaly.',
      nextStep: 'Inspect machine and verify build plate.',
      confidence: edgeData.highest_confidence,
    });

    // ── PHASE 3: CLOUD DIAGNOSTIC ESCALATION ──────────────────────────────
    try {
      const incidentReport = await generateGroqIncidentReport(frameBase64);
      return {
        status: 'failure',
        edge_triaged: true,
        highest_confidence: edgeData.highest_confidence,
        detections: edgeData.detections || [],
        incident_report: incidentReport,
      };
    } catch (groqErr) {
      console.warn('[Cloud Escalation Fallback]:', groqErr.message);
      return {
        status: 'failure',
        edge_triaged: true,
        highest_confidence: edgeData.highest_confidence,
        detections: edgeData.detections || [],
        incident_report: `Anomaly detected by edge triage (confidence: ${edgeData.highest_confidence}). Cloud reasoning unavailable.`,
      };
    }
  }

  // Fallback: Edge server is not active; caller should route to standard VLM pipeline
  return { status: 'fallback_to_cloud', reason: 'edge_server_offline' };
}

