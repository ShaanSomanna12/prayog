import fs from 'fs';

async function testRealSpaghetti() {
  const imagePath = 'E:/Vision-OPS-Monitoring-main/Spaghetti-3D-1/test/images/-_jpg.rf.9f6fc4c343b9db6ef8bb3d38cb1049db.jpg';
  console.log(`Loading real spaghetti failure image from: ${imagePath}`);
  
  const imgBuffer = fs.readFileSync(imagePath);
  const base64Data = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;

  console.log('Sending spaghetti frame to Edge Inference Server (http://localhost:8000/analyze)...');
  const t0 = Date.now();
  const res = await fetch('http://localhost:8000/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Data }),
  });

  const latency = Date.now() - t0;
  console.log(`HTTP Status: ${res.status}`);
  const result = await res.json();
  console.log('Analysis Result:', JSON.stringify(result, null, 2));
  console.log(`Latency: ${latency}ms`);
}

testRealSpaghetti().catch(console.error);
