import fs from 'fs';

async function testSpaghettiE2E() {
  const imagePath = 'E:/Vision-OPS-Monitoring-main/Spaghetti-3D-1/test/images/-_jpg.rf.9f6fc4c343b9db6ef8bb3d38cb1049db.jpg';
  console.log(`Loading real spaghetti failure image from: ${imagePath}`);
  
  const imgBuffer = fs.readFileSync(imagePath);
  const base64Data = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;

  console.log('Sending spaghetti frame to Watch Guard main server (http://localhost:3001/api/analyze-machine)...');
  const t0 = Date.now();
  const res = await fetch('http://localhost:3001/api/analyze-machine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentImageDataUrl: base64Data,
      cameraId: 'printer_alpha',
      cameraLabel: 'Ender 3 Pro (Camera 1)',
      machineType: '3d_printer',
    }),
  });

  const latency = Date.now() - t0;
  console.log(`HTTP Status: ${res.status}`);
  const result = await res.json();
  console.log('Final Triage Result:\n', JSON.stringify(result, null, 2));
  console.log(`Latency: ${latency}ms`);
}

testSpaghettiE2E().catch(console.error);

