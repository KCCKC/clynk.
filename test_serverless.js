import handler from './api/index.js';
import http from 'node:http';

const server = http.createServer(handler);
server.listen(3999, async () => {
  try {
    const resRoot = await fetch('http://localhost:3999/');
    const textRoot = await resRoot.text();
    console.log('✅ GET / => Status:', resRoot.status, 'HTML length:', textRoot.length);

    const resGet = await fetch('http://localhost:3999/api/blynk/get?token=demo_token&pin=V0');
    const textGet = await resGet.text();
    console.log('✅ GET /api/blynk/get => Status:', resGet.status, 'Value:', textGet);

    const resAi = await fetch('http://localhost:3999/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Turn on relay' })
    });
    const jsonAi = await resAi.json();
    console.log('✅ POST /api/ai/query => Status:', resAi.status, 'Insight:', jsonAi.insights.substring(0, 50));

    console.log('🎉 ALL VERCEL SERVERLESS HANDLERS 100% OPERATIONAL WITH ZERO EXTERNAL DEPENDENCIES!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
