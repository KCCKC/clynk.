/**
 * =====================================================================
 *  Blynk Alter / Clynk - Dedicated Server Entrypoint
 *  Usage: node server.js  or  agy-node server.js
 *  Serves complete dashboard on http://localhost:3000 and on Vercel
 * =====================================================================
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

// In-Memory Cloud State
const pinStore = new Map([
  ['V0', '24.8'],
  ['V1', '58.5'],
  ['V2', '0'],
  ['V3', '128'],
  ['V4', '3.82'],
  ['V5', '#06B6D4'],
  ['V6', '1013.2']
]);

const telemetryHistory = {
  'V0': [],
  'V1': [],
  'V4': []
};

// Seed initial history
const now = Date.now();
for (let i = 20; i >= 0; i--) {
  const t = now - i * 5000;
  telemetryHistory['V0'].push({ timestamp: t, value: +(24.5 + Math.sin(i / 3) * 1.5).toFixed(1) });
  telemetryHistory['V1'].push({ timestamp: t, value: +(58.0 + Math.cos(i / 2) * 4.0).toFixed(1) });
  telemetryHistory['V4'].push({ timestamp: t, value: +(3.82 + (Math.random() * 0.04 - 0.02)).toFixed(2) });
}

function updatePinState(pin, value) {
  const p = pin.toUpperCase();
  const valStr = String(value);
  pinStore.set(p, valStr);

  const num = parseFloat(valStr);
  if (!telemetryHistory[p]) telemetryHistory[p] = [];
  telemetryHistory[p].push({ timestamp: Date.now(), value: isNaN(num) ? 0 : num });
  if (telemetryHistory[p].length > 150) telemetryHistory[p].shift();
}

function getHtml() {
  const possiblePaths = [
    path.join(__dirname, 'index.html'),
    path.join(process.cwd(), 'index.html')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try { return fs.readFileSync(p, 'utf8'); } catch (e) {}
    }
  }
  return '<!DOCTYPE html><html><body><h1>Blynk Alter Platform</h1></body></html>';
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const host = req.headers?.host || 'localhost';
  const urlObj = new URL(req.url, `http://${host}`);
  const pathname = urlObj.pathname;
  const searchParams = Object.fromEntries(urlObj.searchParams.entries());

  let body = {};
  if (req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString();
      if (rawBody) body = JSON.parse(rawBody);
    } catch (e) {}
  }

  const params = { ...searchParams, ...body };

  // 1. API: /api/blynk/update
  if (pathname.includes('/api/blynk/update') || pathname.includes('/update')) {
    const token = params.token || 'demo_token';
    const updated = {};

    if (params.pin && params.value !== undefined) {
      updatePinState(params.pin, params.value);
      updated[params.pin.toUpperCase()] = params.value;
    }

    for (const [k, v] of Object.entries(params)) {
      if (/^[vVaAdD]\d+$/i.test(k)) {
        updatePinState(k, v);
        updated[k.toUpperCase()] = v;
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      status: 'ok',
      token,
      updated,
      timestamp: Date.now()
    }));
  }

  // 2. API: /api/blynk/get
  if (pathname.includes('/api/blynk/get') || pathname.includes('/get')) {
    const pin = (params.pin || 'V0').toUpperCase();
    const value = pinStore.get(pin) ?? '0';

    if (params.format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, pin, value, timestamp: Date.now() }));
    }
    res.setHeader('Content-Type', 'text/plain');
    return res.end(String(value));
  }

  // 3. API: /api/blynk/history
  if (pathname.includes('/api/blynk/history') || pathname.includes('/history')) {
    const pin = (params.pin || 'V0').toUpperCase();
    const limit = parseInt(params.limit, 10) || 50;
    const hist = (telemetryHistory[pin] || []).slice(-limit);

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      pin,
      count: hist.length,
      data: hist
    }));
  }

  // 4. API: /api/ai/query
  if (pathname.includes('/api/ai/query') || pathname.includes('/query')) {
    const prompt = (params.prompt || '').toLowerCase();
    const v0 = parseFloat(pinStore.get('V0') || '25');
    const v1 = parseFloat(pinStore.get('V1') || '58');
    const v4 = parseFloat(pinStore.get('V4') || '3.82');

    let actions = [];
    if (prompt.includes('turn on relay') || prompt.includes('relay on')) {
      updatePinState('V2', '1');
      actions.push({ pin: 'V2', value: '1', label: 'Relay 1 ON' });
    }
    if (prompt.includes('turn off relay') || prompt.includes('relay off')) {
      updatePinState('V2', '0');
      actions.push({ pin: 'V2', value: '0', label: 'Relay 1 OFF' });
    }

    const dataPoints = [];
    const currTime = Date.now();
    for (let i = 11; i >= 0; i--) {
      const t = new Date(currTime - i * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dataPoints.push({
        time: t,
        temperature: +(v0 + Math.sin(i / 2) * 2.2).toFixed(1),
        humidity: +(v1 - Math.sin(i / 2) * 5.0).toFixed(1),
        voltage: +(v4 - (11 - i) * 0.015).toFixed(2)
      });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      chartType: 'line',
      title: 'Telemetry Analysis',
      description: 'Real-time telemetry analysis powered by Blynk Alter AI.',
      seriesKeys: ['temperature', 'humidity'],
      data: dataPoints,
      actions,
      insights: `📊 Telemetry nominal. Temperature: ${v0}°C, Humidity: ${v1}%.`
    }));
  }

  // 5. Default / Root: Serve complete HTML Dashboard
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = 200;
  return res.end(getHtml());
});

server.listen(PORT, () => {
  console.log(`🚀 Blynk Alter local dev server running on http://localhost:${PORT}`);
});

export default server;
