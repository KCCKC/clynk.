import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/style.css', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');

// Replace CSS link
let bundleHtml = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);

// Replace JS script tag
bundleHtml = bundleHtml.replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`);

// Write standalone index.html
fs.writeFileSync('index.html', bundleHtml, 'utf8');
fs.writeFileSync('public/index.html', bundleHtml, 'utf8');

console.log('✅ Standalone bundle length:', bundleHtml.length);

// Generate api/index.js (matching exact PUDU architecture)
const apiCode = `/**
 * ============================================================================
 *  Blynk Alter - Serverless Application Gateway (Vercel Entry)
 *  Direct Express gateway matching proven PUDU deployment architecture.
 * ============================================================================
 */

import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Embedded Standalone Blynk Alter UI (All Styles, Widgets & Logic Inlined)
const BLYNK_ALTER_HTML = ${JSON.stringify(bundleHtml)};

// In-Memory Cloud State & Virtual Pins
let pinStore = {
  'V0': '24.8',
  'V1': '58.5',
  'V2': '0',
  'V3': '128',
  'V4': '3.82',
  'V5': '#06B6D4',
  'V6': '1013.2'
};

let telemetryHistory = {
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
  pinStore[p] = valStr;

  const num = parseFloat(valStr);
  if (!telemetryHistory[p]) telemetryHistory[p] = [];
  telemetryHistory[p].push({ timestamp: Date.now(), value: isNaN(num) ? 0 : num });
  if (telemetryHistory[p].length > 150) telemetryHistory[p].shift();
}

// 1. REST API: Update Pin(s)
app.all(['/api/blynk/update', '/api/v1/update'], (req, res) => {
  const params = { ...req.query, ...req.body };
  const token = params.token || 'demo_token';
  const updated = {};

  if (params.pin && params.value !== undefined) {
    updatePinState(params.pin, params.value);
    updated[params.pin.toUpperCase()] = params.value;
  }

  for (const [k, v] of Object.entries(params)) {
    if (/^[vVaAdD]\\d+$/i.test(k)) {
      updatePinState(k, v);
      updated[k.toUpperCase()] = v;
    }
  }

  res.status(200).json({
    success: true,
    status: 'ok',
    token,
    updated,
    timestamp: Date.now()
  });
});

// 2. REST API: Get Pin Value
app.get(['/api/blynk/get', '/api/v1/get'], (req, res) => {
  const pin = (req.query.pin || 'V0').toUpperCase();
  const value = pinStore[pin] ?? '0';

  if (req.query.format === 'json') {
    return res.json({ success: true, pin, value, timestamp: Date.now() });
  }
  res.setHeader('Content-Type', 'text/plain');
  res.send(value);
});

// 3. REST API: Get Telemetry History
app.get(['/api/blynk/history', '/api/v1/history'], (req, res) => {
  const pin = (req.query.pin || 'V0').toUpperCase();
  const limit = parseInt(req.query.limit, 10) || 50;
  const hist = (telemetryHistory[pin] || []).slice(-limit);

  res.json({
    success: true,
    pin,
    count: hist.length,
    data: hist
  });
});

// 4. REST API: AI IoT Copilot
app.post(['/api/ai/query', '/api/v1/ai/query'], (req, res) => {
  const prompt = (req.body.prompt || '').toLowerCase();
  const v0 = parseFloat(pinStore['V0'] || '25');
  const v1 = parseFloat(pinStore['V1'] || '58');
  const v4 = parseFloat(pinStore['V4'] || '3.82');

  let chartType = 'line';
  let title = 'Live Telemetry Correlation';
  let description = 'Real-time telemetry analysis powered by Blynk Alter AI.';
  let seriesKeys = ['temperature', 'humidity'];
  let actions = [];
  let insights = '';

  if (prompt.includes('turn on relay') || prompt.includes('relay on')) {
    updatePinState('V2', '1');
    actions.push({ pin: 'V2', value: '1', label: 'Relay 1 ON' });
  }
  if (prompt.includes('turn off relay') || prompt.includes('relay off')) {
    updatePinState('V2', '0');
    actions.push({ pin: 'V2', value: '0', label: 'Relay 1 OFF' });
  }
  const pwmMatch = prompt.match(/(?:pwm|brightness|dim|light).*?(\\d{1,3})%/i);
  if (pwmMatch) {
    const pct = Math.min(100, Math.max(0, parseInt(pwmMatch[1], 10)));
    const pwmVal = Math.round((pct / 100) * 255);
    updatePinState('V3', String(pwmVal));
    actions.push({ pin: 'V3', value: String(pwmVal), label: \`PWM Brightness \${pct}%\` });
  }

  if (prompt.includes('battery') || prompt.includes('voltage')) {
    title = 'Battery Discharge & Voltage Stability';
    seriesKeys = ['voltage', 'estimated_percentage'];
    description = \`Current battery is at \${v4}V. Health is optimal.\`;
    insights = '🔋 Battery health index is 94%. Estimated operating time remaining: 38.4 hours.';
  } else if (prompt.includes('anomaly') || prompt.includes('spike')) {
    title = 'Sensor Anomaly & Jitter Audit';
    seriesKeys = ['temperature', 'baseline'];
    description = \`Thermal delta: \${(v0 - 24.0).toFixed(1)}°C from baseline.\`;
    insights = v0 > 35 ? \`⚠️ Ambient temp (\${v0}°C) has crossed safety threshold (35°C).\` : '✅ Sensors nominal.';
  } else {
    title = 'Ambient Temperature vs Relative Humidity';
    seriesKeys = ['temperature', 'humidity'];
    description = \`Tracking thermal inverse correlation between V0 (\${v0}°C) and V1 (\${v1}%).\`;
    insights = '📊 Inverse correlation observed (-0.78). Normal diurnal climate cycle.';
  }

  const dataPoints = [];
  const currTime = Date.now();
  for (let i = 11; i >= 0; i--) {
    const t = new Date(currTime - i * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dataPoints.push({
      time: t,
      temperature: +(v0 + Math.sin(i / 2) * 2.2).toFixed(1),
      humidity: +(v1 - Math.sin(i / 2) * 5.0).toFixed(1),
      voltage: +(v4 - (11 - i) * 0.015).toFixed(2),
      estimated_percentage: Math.round(((v4 - 3.0) / 1.2) * 100),
      baseline: 24.5
    });
  }

  res.json({
    chartType,
    title,
    description,
    seriesKeys,
    data: dataPoints,
    actions,
    insights
  });
});

// Root Route: Send Embedded Standalone Dashboard HTML directly (Zero 404s guaranteed)
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(BLYNK_ALTER_HTML);
});

export default app;
`;

fs.writeFileSync('api/index.js', apiCode, 'utf8');
console.log('✅ api/index.js generated, length:', apiCode.length);
