import 'dotenv/config';

// 1x1 transparent PNG data URL
const dummyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testPipeline() {
  console.log('Testing Watch Guard Pipeline End-to-End...');
  console.log('Sending frame to http://localhost:3001/api/analyze-machine...');

  const t0 = Date.now();
  const res = await fetch('http://localhost:3001/api/analyze-machine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentImageDataUrl: dummyPng,
      cameraId: 'cam_test_e2e',
      cameraLabel: 'Ender 3 (Pipeline Test)',
      machineType: '3d_printer',
    }),
  });

  const latency = Date.now() - t0;
  console.log(`HTTP Status: ${res.status}`);
  const data = await res.json();
  console.log('Response Payload:', JSON.stringify(data, null, 2));
  console.log(`Total Roundtrip Latency: ${latency}ms`);
}

testPipeline().catch(console.error);

