import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- In-Memory Datastream Store (V0 to V15) ---
const pinStore = new Map([
  ['V0', '28.3'], // Temperature (°C)
  ['V1', '89.0'], // Humidity (%)
  ['V2', '0'],    // Alarm (0 or 1)
  ['V3', '1'],    // Water Pump (0 or 1)
  ['V4', '3.82'], // ESP32 Voltage (V)
  ['V5', '0'],    // Lighting Actuator (0 or 1)
  ['V6', '46.0'], // Soil Moisture (%)
  ['V7', '340'],  // Solar Lux (lux)
  ['V8', '0'],
  ['V9', '0'],
  ['V10', '0'],
  ['V11', '0'],
  ['V12', '0'],
  ['V13', '0'],
  ['V14', '0'],
  ['V15', '0']
]);

// Helper to serve index.html
function getHtml() {
  try {
    return fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  } catch (e) {
    try {
      return fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    } catch (err) {
      return '<!DOCTYPE html><html><body><h1>Blynk.Console</h1></body></html>';
    }
  }
}

// --- API Route 1: /api/blynk/update (or /blynk/update) ---
app.all(['/api/blynk/update', '/blynk/update'], (req, res) => {
  const q = { ...req.query, ...req.body };
  
  if (q.pin && q.value !== undefined) {
    pinStore.set(q.pin.toUpperCase(), String(q.value));
  }
  for (const [k, v] of Object.entries(q)) {
    if (/^[vVaAdD]\d+$/i.test(k)) {
      pinStore.set(k.toUpperCase(), String(v));
    }
  }

  res.setHeader('Content-Type', 'application/json');
  return res.json({ success: true, status: 'ok', updated: q });
});

// --- API Route 2: /api/blynk/get (or /blynk/get) ---
app.all(['/api/blynk/get', '/blynk/get'], (req, res) => {
  const pin = (req.query.pin || req.body?.pin || 'V0').toUpperCase();
  const val = pinStore.get(pin) || '0';

  if (req.query.format === 'json') {
    return res.json({ success: true, pin, value: val });
  }
  res.setHeader('Content-Type', 'text/plain');
  return res.send(String(val));
});

// --- API Route 3: /api/pins (All pins JSON) ---
app.get('/api/pins', (req, res) => {
  const pinsObj = Object.fromEntries(pinStore);
  return res.json({ success: true, pins: pinsObj });
});

// --- API Route 4: Health Check ---
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Root Route: Serve Blynk 2.0 Console HTML ---
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getHtml());
});

// Local dev server listener
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Blynk.Console Server running on http://localhost:${PORT}`);
  });
}

export default app;
