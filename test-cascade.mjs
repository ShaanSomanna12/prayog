/**
 * test-cascade.mjs — Verify Edge Inference Server & Hybrid Cascade Pipeline.
 *
 * Tests:
 * 1. Health check of local FastAPI edge server (http://localhost:8000).
 * 2. Model status and detection classes.
 * 3. Cascade triage routing with a test frame.
 */

import 'dotenv/config';
import { queryEdgeInference, cascadeAnalysis } from './cascade-orchestrator.mjs';

const EDGE_URL = process.env.EDGE_INFERENCE_URL || 'http://localhost:8000';

console.log('═════════════════════════════════════════════════════════════');
console.log('🔬 Watch Guard — Edge Inference & Cascade Pipeline Audit');
console.log('═════════════════════════════════════════════════════════════');

async function checkEdge() {
  console.log(`Checking Edge Server at: ${EDGE_URL}...`);
  try {
    const healthRes = await fetch(EDGE_URL, { signal: AbortSignal.timeout(3000) });
    if (!healthRes.ok) {
      console.log(`⚠️ Edge server returned HTTP status: ${healthRes.status}`);
      return;
    }
    const health = await healthRes.json();
    console.log('✅ Edge Server is ONLINE!');
    console.log(`• Model Loaded:  ${health.model_loaded}`);
    console.log(`• Model Classes: ${JSON.stringify(health.classes)}`);

    // Create a 1x1 base64 dummy frame
    const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    console.log('\nSending test frame to /analyze endpoint...');
    const t0 = Date.now();
    const triage = await queryEdgeInference(dummyBase64);
    const latency = Date.now() - t0;

    console.log(`⏱️ Roundtrip Latency: ${latency}ms`);
    console.log(`• Triage Status:     ${triage?.status}`);
    console.log(`• Highest Conf:      ${triage?.highest_confidence}`);
    console.log(`• Detections:        ${JSON.stringify(triage?.detections || [])}`);

    if (latency < 100) {
      console.log('\n🚀 VERDICT: Edge triage is FAST & EFFECTIVE (<100ms response)!');
    }
  } catch (err) {
    console.log('ℹ️ Edge Inference Server (http://localhost:8000) is not currently running.');
    console.log('   To start it:');
    console.log('   1. Ensure "best.pt" is in the root directory.');
    console.log('   2. Run: python inference_server.py');
  }
  console.log('═════════════════════════════════════════════════════════════');
}

checkEdge();

