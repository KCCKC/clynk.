// In-Memory State
const pinStore = new Map([
  ['V0', '24.8'], ['V1', '58.5'], ['V2', '0'],
  ['V3', '128'], ['V4', '3.82'], ['V5', '#06B6D4'], ['V6', '1013.2']
]);
const telemetryHistory = { 'V0': [], 'V1': [], 'V4': [] };

export default async function handler(req, res) {
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
  if (req.body) {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }

  const params = { ...searchParams, ...body };

  // 1. API: /api/blynk/update
  if (pathname.includes('/api/blynk/update') || pathname.includes('/update')) {
    const token = params.token || 'demo_token';
    const updated = {};
    if (params.pin && params.value !== undefined) {
      pinStore.set(params.pin.toUpperCase(), String(params.value));
      updated[params.pin.toUpperCase()] = params.value;
    }
    for (const [k, v] of Object.entries(params)) {
      if (/^[vVaAdD]\d+$/i.test(k)) {
        pinStore.set(k.toUpperCase(), String(v));
        updated[k.toUpperCase()] = v;
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, status: 'ok', token, updated, timestamp: Date.now() }));
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
    return res.end(JSON.stringify({ success: true, pin, count: hist.length, data: hist }));
  }

  // 4. API: /api/ai/query
  if (pathname.includes('/api/ai/query') || pathname.includes('/query')) {
    const prompt = (params.prompt || '').toLowerCase();
    const v0 = parseFloat(pinStore.get('V0') || '25');
    const v1 = parseFloat(pinStore.get('V1') || '58');
    const v4 = parseFloat(pinStore.get('V4') || '3.82');

    let actions = [];
    if (prompt.includes('turn on relay') || prompt.includes('relay on')) {
      pinStore.set('V2', '1');
      actions.push({ pin: 'V2', value: '1', label: 'Relay 1 ON' });
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

  res.statusCode = 404;
  res.end('Not Found');
}
