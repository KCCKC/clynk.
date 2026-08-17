import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/style.css', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');

// Build standalone HTML bundle
let bundleHtml = html;
bundleHtml = bundleHtml.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);
bundleHtml = bundleHtml.replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`);

fs.writeFileSync('index.html', bundleHtml, 'utf8');
fs.writeFileSync('public/index.html', bundleHtml, 'utf8');

// Generate 100% Zero-Dependency Universal Vercel Serverless Function in api/index.js
const apiCode = `/**
 * ============================================================================
 *  Blynk Alter - 100% Zero-Dependency Universal Serverless Gateway (Vercel)
 *  Embedded Standalone Architecture (Zero external npm packages, zero cold crashes)
 * ============================================================================
 */

// Embedded Standalone Blynk Alter Dashboard (All HTML, CSS & JS Inlined)
const BLYNK_ALTER_HTML = ${JSON.stringify(bundleHtml)};

// In-Memory Cloud State & Virtual Pins
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

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const host = req.headers?.host || 'localhost';
  const urlObj = new URL(req.url, \`http://\${host}\`);
  const pathname = urlObj.pathname;
  const searchParams = Object.fromEntries(urlObj.searchParams.entries());

  // Parse Body
  let body = {};
  if (req.body) {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  } else if (req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString();
      if (rawBody) body = JSON.parse(rawBody);
    } catch (e) {}
  }

  const params = { ...searchParams, ...body };

  // 1. API: /api/blynk/update
  if (pathname.startsWith('/api/blynk/update') || pathname.startsWith('/api/v1/update')) {
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
  if (pathname.startsWith('/api/blynk/get') || pathname.startsWith('/api/v1/get')) {
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
  if (pathname.startsWith('/api/blynk/history') || pathname.startsWith('/api/v1/history')) {
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
  if (pathname.startsWith('/api/ai/query') || pathname.startsWith('/api/v1/ai/query')) {
    const prompt = (params.prompt || '').toLowerCase();
    const v0 = parseFloat(pinStore.get('V0') || '25');
    const v1 = parseFloat(pinStore.get('V1') || '58');
    const v4 = parseFloat(pinStore.get('V4') || '3.82');

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

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      chartType,
      title,
      description,
      seriesKeys,
      data: dataPoints,
      actions,
      insights
    }));
  }

  // 5. Universal Root / SPA Fallback: Serve Embedded HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = 200;
  return res.end(BLYNK_ALTER_HTML);
}
`;

fs.writeFileSync('api/index.js', apiCode, 'utf8');
console.log('✅ Generated 100% Zero-Dependency Universal Vercel handler in api/index.js, size:', apiCode.length);
