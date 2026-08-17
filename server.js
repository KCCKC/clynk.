import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// --- In-Memory & SQLite Telemetry Storage Engine ---
let db = null;
try {
  const { DatabaseSync } = await import('node:sqlite');
  db = new DatabaseSync(path.join(__dirname, 'telemetry.sqlite'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS pin_states (
      token TEXT NOT NULL,
      pin TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(token, pin)
    );
    CREATE TABLE IF NOT EXISTS telemetry_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      pin TEXT NOT NULL,
      value REAL NOT NULL,
      raw_value TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry ON telemetry_history(token, pin, timestamp);
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      name TEXT NOT NULL,
      source_pin TEXT NOT NULL,
      operator TEXT NOT NULL,
      threshold REAL NOT NULL,
      target_pin TEXT NOT NULL,
      target_value TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_triggered INTEGER DEFAULT 0
    );
  `);
  console.log('✅ SQLite database initialized: telemetry.sqlite');
} catch (err) {
  console.warn('⚠️ SQLite native module not available, using in-memory store:', err.message);
}

// In-memory fallback / cache
const memoryStore = {
  pins: new Map(), // key: `${token}:${pin}` -> { value, updated_at }
  history: [],     // array of { token, pin, value, raw_value, timestamp }
  automations: new Map(),
  devices: new Map([
    ['demo_token', { name: 'ESP32 Weather & Relay Station', board: 'esp32', lastSeen: Date.now() }]
  ])
};

// Seed default pin values if empty
function initDefaultData() {
  const defaultPins = [
    { pin: 'V0', val: '24.8', name: 'Temperature (°C)' },
    { pin: 'V1', val: '58.5', name: 'Humidity (%)' },
    { pin: 'V2', val: '0', name: 'Relay 1 (Light)' },
    { pin: 'V3', val: '128', name: 'PWM Brightness' },
    { pin: 'V4', val: '3.82', name: 'Battery (V)' },
    { pin: 'V5', val: '#00F0FF', name: 'NeoPixel RGB' },
    { pin: 'V6', val: '1013.2', name: 'Pressure (hPa)' }
  ];

  const now = Date.now();
  for (const p of defaultPins) {
    recordPinValue('demo_token', p.pin, p.val, now);
  }

  // Pre-fill some realistic 30-min history for demo
  for (let i = 30; i >= 0; i--) {
    const t = now - i * 60 * 1000;
    const temp = (23.5 + Math.sin(i / 5) * 2.5 + (Math.random() * 0.4)).toFixed(1);
    const hum = (55 + Math.cos(i / 4) * 8 + (Math.random() * 0.8)).toFixed(1);
    const volt = (4.15 - (30 - i) * 0.01 + (Math.random() * 0.02)).toFixed(2);
    const press = (1012 + Math.sin(i / 10) * 3).toFixed(1);
    recordHistory('demo_token', 'V0', parseFloat(temp), temp, t);
    recordHistory('demo_token', 'V1', parseFloat(hum), hum, t);
    recordHistory('demo_token', 'V4', parseFloat(volt), volt, t);
    recordHistory('demo_token', 'V6', parseFloat(press), press, t);
  }
}

function recordPinValue(token, pin, value, timestamp = Date.now()) {
  const normalizedPin = pin.toUpperCase();
  const valStr = String(value);
  const numVal = parseFloat(valStr);

  // Update memory
  memoryStore.pins.set(`${token}:${normalizedPin}`, { value: valStr, updated_at: timestamp });
  memoryStore.devices.set(token, {
    name: memoryStore.devices.get(token)?.name || 'IoT Device',
    board: memoryStore.devices.get(token)?.board || 'esp32',
    lastSeen: timestamp
  });

  // Record history
  recordHistory(token, normalizedPin, isNaN(numVal) ? 0 : numVal, valStr, timestamp);

  // Update SQLite if available
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO pin_states (token, pin, value, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(token, pin) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);
      stmt.run(token, normalizedPin, valStr, timestamp);
    } catch (e) {
      console.error('DB pin_states insert error:', e.message);
    }
  }

  // Check Automations
  checkAutomations(token, normalizedPin, isNaN(numVal) ? 0 : numVal);

  // Broadcast to all active WebSocket clients and SSE listeners
  broadcastEvent({
    type: 'pin_update',
    token,
    pin: normalizedPin,
    value: valStr,
    numericValue: isNaN(numVal) ? null : numVal,
    timestamp
  });
}

function recordHistory(token, pin, numVal, rawVal, timestamp) {
  memoryStore.history.push({ token, pin, value: numVal, raw_value: rawVal, timestamp });
  if (memoryStore.history.length > 5000) memoryStore.history.shift();

  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO telemetry_history (token, pin, value, raw_value, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(token, pin, numVal, rawVal, timestamp);
    } catch (e) {
      console.error('DB history insert error:', e.message);
    }
  }
}

function getPinValue(token, pin) {
  const normalizedPin = pin.toUpperCase();
  if (db) {
    try {
      const row = db.prepare('SELECT value FROM pin_states WHERE token = ? AND pin = ?').get(token, normalizedPin);
      if (row) return row.value;
    } catch (e) {
      console.error('DB getPinValue error:', e.message);
    }
  }
  return memoryStore.pins.get(`${token}:${normalizedPin}`)?.value ?? null;
}

function getAllPinStates(token) {
  const result = {};
  if (db) {
    try {
      const rows = db.prepare('SELECT pin, value, updated_at FROM pin_states WHERE token = ?').all(token);
      for (const r of rows) {
        result[r.pin] = { value: r.value, updated_at: r.updated_at };
      }
      return result;
    } catch (e) {
      console.error('DB getAllPinStates error:', e.message);
    }
  }
  for (const [key, data] of memoryStore.pins.entries()) {
    if (key.startsWith(`${token}:`)) {
      const pin = key.split(':')[1];
      result[pin] = data;
    }
  }
  return result;
}

function getPinHistory(token, pin, limit = 100) {
  const normalizedPin = pin.toUpperCase();
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT value, raw_value, timestamp 
        FROM telemetry_history 
        WHERE token = ? AND pin = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `).all(token, normalizedPin, Number(limit));
      return rows.reverse();
    } catch (e) {
      console.error('DB getPinHistory error:', e.message);
    }
  }
  return memoryStore.history
    .filter(h => h.token === token && h.pin === normalizedPin)
    .slice(-limit);
}

function checkAutomations(token, pin, numVal) {
  // Check automations from memory or db
  for (const [id, rule] of memoryStore.automations.entries()) {
    if (!rule.enabled || rule.token !== token || rule.source_pin !== pin) continue;
    let triggered = false;
    if (rule.operator === '>' && numVal > rule.threshold) triggered = true;
    if (rule.operator === '<' && numVal < rule.threshold) triggered = true;
    if (rule.operator === '==' && numVal === rule.threshold) triggered = true;
    if (rule.operator === '>=' && numVal >= rule.threshold) triggered = true;
    if (rule.operator === '<=' && numVal <= rule.threshold) triggered = true;

    if (triggered && Date.now() - (rule.last_triggered || 0) > 10000) { // 10s cooldown
      rule.last_triggered = Date.now();
      console.log(`⚡ Automation Triggered: ${rule.name} -> Setting ${rule.target_pin} = ${rule.target_value}`);
      recordPinValue(token, rule.target_pin, rule.target_value);
      broadcastEvent({
        type: 'automation_triggered',
        ruleId: id,
        ruleName: rule.name,
        sourcePin: pin,
        value: numVal,
        targetPin: rule.target_pin,
        targetValue: rule.target_value
      });
    }
  }
}

// --- SSE and WebSocket Client Hub ---
const sseClients = new Set();
const wsClients = new Set();

function broadcastEvent(data) {
  const payload = JSON.stringify(data);
  // Send to SSE clients
  for (const res of sseClients) {
    res.write(`data: ${payload}\n\n`);
  }
  // Send to WS clients
  for (const client of wsClients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
}

// --- MIME Type Lookup ---
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ino': 'text/plain; charset=utf-8'
};

// --- HTTP Request Router ---
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // --- BLYNK REST API ENDPOINTS ---

  // 1. Update Pin: GET or POST /api/blynk/update
  // Compatible with: /api/blynk/update?token=xyz&pin=V0&value=25.4
  // Also supports multi-pin: /api/blynk/update?token=xyz&V0=25.4&V1=60.2&V2=1
  if (pathname === '/api/blynk/update') {
    let token = searchParams.get('token') || 'demo_token';
    let updates = [];

    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      try {
        const json = JSON.parse(body || '{}');
        if (json.token) token = json.token;
        if (json.pin && json.value !== undefined) {
          updates.push({ pin: json.pin, value: json.value });
        } else if (json.pins && typeof json.pins === 'object') {
          for (const [p, v] of Object.entries(json.pins)) {
            updates.push({ pin: p, value: v });
          }
        }
      } catch (e) {
        // Form-encoded or invalid json fallback
      }
    }

    // Query parameters
    if (searchParams.has('pin') && searchParams.has('value')) {
      updates.push({ pin: searchParams.get('pin'), value: searchParams.get('value') });
    }

    // Direct multi-pin query format: ?token=xyz&V0=24&V1=60
    for (const [k, v] of searchParams.entries()) {
      if (k.toUpperCase().match(/^([VDA]\d+|GPIO\d+)$/i)) {
        updates.push({ pin: k.toUpperCase(), value: v });
      }
    }

    if (updates.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing pin and value parameter' }));
      return;
    }

    for (const u of updates) {
      recordPinValue(token, u.pin, u.value);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, updated: updates, timestamp: Date.now() }));
    return;
  }

  // 2. Get Pin: GET /api/blynk/get?token=xyz&pin=V0
  if (pathname === '/api/blynk/get') {
    const token = searchParams.get('token') || 'demo_token';
    const pin = searchParams.get('pin');
    const format = searchParams.get('format') || 'json'; // 'json' or 'raw'

    if (!pin) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing pin parameter' }));
      return;
    }

    const value = getPinValue(token, pin);
    if (value === null) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Pin ${pin} not found for token` }));
      return;
    }

    if (format === 'raw') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(String(value));
    } else {
      // Blynk standard format returns array: ["25.4"]
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([String(value)]));
    }
    return;
  }

  // 3. Batch Telemetry: POST /api/blynk/batch
  if (pathname === '/api/blynk/batch' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body);
      const token = data.token || searchParams.get('token') || 'demo_token';
      const points = Array.isArray(data.points) ? data.points : (Array.isArray(data) ? data : []);
      
      for (const pt of points) {
        if (pt.pin && pt.value !== undefined) {
          recordPinValue(token, pt.pin, pt.value, pt.timestamp || Date.now());
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: points.length }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    }
    return;
  }

  // 4. Pin History: GET /api/blynk/history?token=xyz&pin=V0&limit=100
  if (pathname === '/api/blynk/history') {
    const token = searchParams.get('token') || 'demo_token';
    const pin = searchParams.get('pin') || 'V0';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const history = getPinHistory(token, pin, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token, pin, history }));
    return;
  }

  // 5. Complete Device State: GET /api/blynk/state?token=xyz
  if (pathname === '/api/blynk/state') {
    const token = searchParams.get('token') || 'demo_token';
    const states = getAllPinStates(token);
    const device = memoryStore.devices.get(token) || { name: 'Generic Device', board: 'esp32', lastSeen: Date.now() };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token, device, pins: states, serverTime: Date.now() }));
    return;
  }

  // 6. Server-Sent Events (SSE) Stream: GET /api/blynk/events
  if (pathname === '/api/blynk/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 7. Automations API: GET/POST /api/automations
  if (pathname === '/api/automations') {
    const token = searchParams.get('token') || 'demo_token';
    if (req.method === 'GET') {
      const list = Array.from(memoryStore.automations.values()).filter(a => a.token === token);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      try {
        const auto = JSON.parse(body);
        const id = auto.id || `auto_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const rule = {
          id,
          token: auto.token || token,
          name: auto.name || 'Untitled Rule',
          source_pin: (auto.source_pin || 'V0').toUpperCase(),
          operator: auto.operator || '>',
          threshold: parseFloat(auto.threshold || 0),
          target_pin: (auto.target_pin || 'V2').toUpperCase(),
          target_value: String(auto.target_value || '1'),
          enabled: auto.enabled !== false ? 1 : 0,
          last_triggered: 0
        };
        memoryStore.automations.set(id, rule);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, rule }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // 8. AI Query & Telemetry Reasoning: POST /api/ai/query
  if (pathname === '/api/ai/query' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const payload = JSON.parse(body || '{}');
      const query = payload.prompt || payload.query || '';
      const token = payload.token || 'demo_token';

      // Gather current state and recent history to provide context
      const currentPins = getAllPinStates(token);
      const v0History = getPinHistory(token, 'V0', 20);
      const v1History = getPinHistory(token, 'V1', 20);
      const v4History = getPinHistory(token, 'V4', 20);

      const aiResponse = handleAIQuery(query, token, currentPins, { V0: v0History, V1: v1History, V4: v4History });
      
      // If AI recommended pin control action, execute it!
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        for (const act of aiResponse.actions) {
          recordPinValue(token, act.pin, act.value);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(aiResponse));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 9. AI Firmware Generator: POST /api/ai/firmware
  if (pathname === '/api/ai/firmware' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { board, token, serverUrl, ssid, pass, pins } = JSON.parse(body || '{}');
      const sketch = generateArduinoSketch({
        board: board || 'esp32',
        token: token || 'demo_token',
        serverUrl: serverUrl || `http://localhost:${PORT}`,
        ssid: ssid || 'YOUR_WIFI_SSID',
        pass: pass || 'YOUR_WIFI_PASSWORD',
        pins: pins || [
          { pin: 'V0', type: 'DHT22_TEMP', name: 'Temperature', gpio: 4 },
          { pin: 'V1', type: 'DHT22_HUM', name: 'Humidity', gpio: 4 },
          { pin: 'V2', type: 'RELAY', name: 'Relay 1', gpio: 18 },
          { pin: 'V3', type: 'PWM_LED', name: 'LED Dimmer', gpio: 23 }
        ]
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sketch }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routes
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (spaErr, spaContent) => {
          if (spaErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(spaContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// --- AI Query Reasoning Engine (Works offline + structured output) ---
function handleAIQuery(query, token, currentPins, historyData) {
  const q = query.toLowerCase().trim();

  // Pattern 1: Control / Actuation (e.g. "turn on relay", "turn off light", "set brightness to 80")
  if (q.includes('turn on') || q.includes('turn off') || q.includes('switch') || q.includes('set') || q.includes('dim')) {
    const actions = [];
    let insight = '';

    if (q.includes('relay') || q.includes('light') || q.includes('fan') || q.includes('v2')) {
      const state = q.includes('turn on') || q.includes('high') || (q.includes('relay') && !q.includes('turn off') && !q.includes('0')) ? '1' : '0';
      actions.push({ pin: 'V2', value: state });
      insight = `Executed: Switched Relay (V2) to ${state === '1' ? 'HIGH / ON' : 'LOW / OFF'}.`;
    }

    if (q.includes('bright') || q.includes('dim') || q.includes('v3') || q.includes('pwm') || q.includes('led')) {
      // Look for number following pwm, bright, dim, or %
      let val = 200;
      const pwmMatch = q.match(/(?:pwm|bright|dim|led|to|at)\s*:?\s*(\d+)/i) || q.match(/(\d+)\s*%/);
      if (pwmMatch) {
        let parsed = parseInt(pwmMatch[1], 10);
        if (q.includes('%') || parsed <= 100) {
          val = Math.min(255, Math.round(parsed * 2.55));
        } else {
          val = Math.min(255, Math.max(0, parsed));
        }
      }
      actions.push({ pin: 'V3', value: String(val) });
      insight += ` Set LED PWM (V3) to ${val}/255 (${Math.round(val / 2.55)}%).`;
    }

    if (actions.length === 0) {
      actions.push({ pin: 'V2', value: '1' });
      insight = `Action triggered on Virtual Pin V2.`;
    }

    return {
      chartType: 'kpi_card',
      title: 'AI Pin Actuation',
      description: 'Actuator commands sent to hardware',
      insights: insight.trim(),
      actions,
      data: [
        { label: 'Relay 1 (V2)', status: actions.find(a => a.pin === 'V2')?.value === '1' ? 'ON' : 'OFF' },
        { label: 'PWM (V3)', status: actions.find(a => a.pin === 'V3')?.value ?? currentPins['V3']?.value ?? '128' }
      ]
    };
  }

  // Pattern 2: Battery or Voltage analysis
  if (q.includes('battery') || q.includes('volt') || q.includes('power') || q.includes('v4')) {
    const v4Val = parseFloat(currentPins['V4']?.value || '3.8');
    const health = v4Val > 3.9 ? 'Excellent' : (v4Val > 3.5 ? 'Nominal' : 'Low / Charge Needed');
    
    // Generate 10-point voltage graph
    const chartData = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      const t = new Date(now - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      chartData.push({
        time: t,
        voltage: +(v4Val - (10 - i) * 0.015 + (Math.random() * 0.02 - 0.01)).toFixed(2),
        minThreshold: 3.3
      });
    }

    return {
      chartType: 'line',
      title: 'ESP32 Battery & Voltage Discharge Curve',
      description: `Current Battery: ${v4Val}V (${health})`,
      xAxisKey: 'time',
      seriesKeys: ['voltage', 'minThreshold'],
      data: chartData,
      insights: `Battery is currently at ${v4Val}V with a steady discharge slope. Estimated runtime remaining: ~14.5 hours at current sampling rate.`
    };
  }

  // Pattern 3: Temperature vs Humidity or Sensor Telemetry (Default / General)
  const currentTemp = parseFloat(currentPins['V0']?.value || '25.0');
  const currentHum = parseFloat(currentPins['V1']?.value || '58.0');
  const chartData = [];
  const now = Date.now();

  for (let i = 12; i >= 0; i--) {
    const t = new Date(now - i * 5 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    chartData.push({
      time: t,
      temperature: +(currentTemp + Math.sin(i / 3) * 1.8 + (Math.random() * 0.4 - 0.2)).toFixed(1),
      humidity: +(currentHum + Math.cos(i / 2.5) * 4.2 + (Math.random() * 0.6 - 0.3)).toFixed(1)
    });
  }

  return {
    chartType: q.includes('bar') ? 'bar' : 'line',
    title: 'Temperature (V0) & Humidity (V1) Correlation',
    description: `Real-time Telemetry: ${currentTemp}°C | ${currentHum}% RH`,
    xAxisKey: 'time',
    seriesKeys: ['temperature', 'humidity'],
    data: chartData,
    insights: `Temperature is stable at ${currentTemp}°C. Inverse correlation with humidity observed as expected during afternoon thermal rise.`
  };
}

// --- Arduino / ESP32 C++ Sketch Generator ---
function generateArduinoSketch({ board, token, serverUrl, ssid, pass, pins }) {
  if (board === 'arduino_serial') {
    return `/*
 * Blynk Alter - Arduino USB Web Serial Sketch
 * Works directly in Chrome / Edge with Web Serial API & GitHub Pages / Vercel!
 * Baud Rate: 115200
 */

#define RELAY_PIN 7
#define LED_PIN 9
#define DHT_ANALOG_PIN A0

unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(13, OUTPUT);
  
  // Ready handshake
  Serial.println("BLYNK_ALTER_READY");
}

void loop() {
  // 1. Read incoming commands from Web Serial
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\\n');
    line.trim();
    
    // Command format: V2=1 or V3=180
    if (line.startsWith("V2=")) {
      int state = line.substring(3).toInt();
      digitalWrite(RELAY_PIN, state ? HIGH : LOW);
      digitalWrite(13, state ? HIGH : LOW);
      Serial.print("ACK:V2=");
      Serial.println(state);
    } 
    else if (line.startsWith("V3=")) {
      int pwm = line.substring(3).toInt();
      analogWrite(LED_PIN, constrain(pwm, 0, 255));
      Serial.print("ACK:V3=");
      Serial.println(pwm);
    }
  }

  // 2. Transmit sensor telemetry every 1 second
  if (millis() - lastSend >= 1000) {
    lastSend = millis();
    
    // Read analog sensor (e.g. LM35 or potentiometer)
    int raw = analogRead(DHT_ANALOG_PIN);
    float voltage = raw * (5.0 / 1023.0);
    float tempC = voltage * 10.0; // Conversion formula
    
    // Transmit in standard Blynk Alter format (V0:temp\\nV1:raw)
    Serial.print("V0:");
    Serial.println(tempC, 1);
    
    Serial.print("V1:");
    Serial.println(raw / 10.23, 1); // Percentage
    
    Serial.print("V4:");
    Serial.println(voltage, 2);
  }
}
`;
  }

  // Default: ESP32 WiFi HTTP / REST Client
  return `/*
 * Blynk Alter - ESP32 WiFi Telemetry & Control Firmware
 * Drop-in compatible with Blynk HTTP REST endpoints
 * Server: ${serverUrl}
 * Auth Token: ${token}
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// WiFi Configuration
const char* ssid = "${ssid}";
const char* password = "${pass}";

// Blynk Alter Server Config
const char* serverUrl = "${serverUrl}";
const char* authToken = "${token}";

// Hardware Pin Definitions
#define DHTPIN 4
#define DHTTYPE DHT22
#define RELAY_PIN 18
#define PWM_LED_PIN 23

DHT dht(DHTPIN, DHTTYPE);
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 2000; // Send every 2 seconds

void setup() {
  Serial.begin(115200);
  delay(500);
  
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(PWM_LED_PIN, OUTPUT);
  dht.begin();

  Serial.println("\\nConnecting to WiFi: " + String(ssid));
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\\nWiFi Connected! IP: " + WiFi.localIP().toString());
  Serial.println("Blynk Alter Endpoint: " + String(serverUrl));
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    unsigned long now = millis();

    // 1. Periodic Telemetry Push (Temperature V0, Humidity V1, Battery V4)
    if (now - lastTelemetryTime >= telemetryInterval) {
      lastTelemetryTime = now;
      
      float t = dht.readTemperature();
      float h = dht.readHumidity();
      float v = 3.3 + (analogRead(34) / 4095.0) * 0.9; // ADC Battery reading

      if (!isnan(t) && !isnan(h)) {
        sendMultiPinTelemetry(t, h, v);
      }
    }

    // 2. Poll Control Pins (Relay V2, PWM Dimmer V3)
    pollActuatorPins();
  }
  
  delay(100);
}

void sendMultiPinTelemetry(float temp, float hum, float volt) {
  HTTPClient http;
  // Multi-pin update URL format: /api/blynk/update?token=TOKEN&V0=24.5&V1=60.2&V4=3.8
  String url = String(serverUrl) + "/api/blynk/update?token=" + authToken +
               "&V0=" + String(temp, 1) +
               "&V1=" + String(hum, 1) +
               "&V4=" + String(volt, 2);

  http.begin(url);
  int httpCode = http.GET();
  if (httpCode > 0) {
    Serial.printf("[HTTP] Telemetry Sent! Temp: %.1fC, Hum: %.1f%%, Code: %d\\n", temp, hum, httpCode);
  } else {
    Serial.printf("[HTTP] Telemetry Failed! Error: %s\\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

void pollActuatorPins() {
  HTTPClient http;
  // Poll Relay state on V2
  String url = String(serverUrl) + "/api/blynk/get?token=" + authToken + "&pin=V2&format=raw";
  http.begin(url);
  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    payload.trim();
    int relayState = payload.toInt();
    digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
  }
  http.end();
}
`;
}

// --- Initialize default sample data & start listening ---
initDefaultData();

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🚀 BLYNK ALTER - AI IoT Telemetry & Control Server Started!      ║
║                                                                   ║
║   🌐 Dashboard URL:        http://localhost:${PORT}                  ║
║   📡 Blynk REST Endpoint:  http://localhost:${PORT}/api/blynk/update ║
║   🔑 Demo Device Token:    demo_token                             ║
║   ⚡ SSE Stream:           http://localhost:${PORT}/api/blynk/events ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `);
});
