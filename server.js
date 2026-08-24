import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const store = new Map([
  ['V0', '24.8'], ['V1', '58.5'], ['V2', '0'], ['V3', '128'], ['V4', '3.82']
]);

function getHtml() {
  try {
    return fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  } catch (e) {
    return '<!DOCTYPE html><html><body><h1>Blynk Alter</h1></body></html>';
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const q = Object.fromEntries(url.searchParams);

  if (path.includes('update')) {
    if (q.pin && q.value !== undefined) store.set(q.pin.toUpperCase(), String(q.value));
    for (const [k, v] of Object.entries(q)) {
      if (/^[vVaAdD]\d+$/i.test(k)) store.set(k.toUpperCase(), String(v));
    }
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, status: 'ok', updated: q }));
  }

  if (path.includes('get')) {
    const pin = (q.pin || 'V0').toUpperCase();
    const val = store.get(pin) || '0';
    if (q.format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, pin, value: val }));
    }
    res.setHeader('Content-Type', 'text/plain');
    return res.end(String(val));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = 200;
  return res.end(getHtml());
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default server;
