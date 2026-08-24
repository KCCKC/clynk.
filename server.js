import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- In-Memory Virtual Pin Store (V0 to V15) ---
const pinStore = new Map([
  ['V0', '24.8'], // Temperature (°C)
  ['V1', '58.5'], // Humidity (%)
  ['V2', '0'],    // Relay 1 (0 or 1)
  ['V3', '128'],  // Light / PWM (0-255)
  ['V4', '3.82'], // Battery / Supply Voltage (V)
  ['V5', '0'],    // Lighting Actuator (0 or 1)
  ['V6', '0'],
  ['V7', '0'],
  ['V8', '0'],
  ['V9', '0'],
  ['V10', '0'],
  ['V11', '0'],
  ['V12', '0'],
  ['V13', '0'],
  ['V14', '0'],
  ['V15', '0']
]);

// --- Embedded Clynk Modern ESP32 Streaming Dashboard HTML ---
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clynk • ESP32 Real-Time IoT Stream Dashboard</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            brand: {
              400: '#34d399',
              500: '#10b981',
              600: '#059669',
            },
            dark: {
              950: '#06080e',
              900: '#0b0f19',
              850: '#111726',
              800: '#172033',
            }
          }
        }
      }
    }
  </script>
  
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-gauges@2.1.7/gauge.min.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>

  <style>
    body {
      background-color: #06080e;
      color: #e2e8f0;
      background-image: 
        radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.08) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.08) 0px, transparent 50%);
      background-attachment: fixed;
    }
    .glass-panel {
      background: rgba(17, 23, 38, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.07);
    }
    .glass-panel:hover {
      border-color: rgba(16, 185, 129, 0.25);
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(11, 15, 25, 0.6);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 0.3; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    .pulse-dot {
      animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col font-sans selection:bg-brand-500 selection:text-black">

  <!-- HEADER -->
  <header class="glass-panel sticky top-0 z-50 border-b border-white/10 px-4 lg:px-8 py-3.5 flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-emerald-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
        <i data-lucide="activity" class="w-6 h-6 text-black font-extrabold"></i>
      </div>
      <div>
        <div class="flex items-center space-x-2">
          <span class="font-extrabold text-xl tracking-tight text-white">CLYNK</span>
          <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">ESP32 Stream</span>
        </div>
        <p class="text-xs text-slate-400">Blynk Cloud Alternative • High Speed Telemetry</p>
      </div>
    </div>

    <!-- Mode Selector -->
    <div class="hidden md:flex items-center space-x-2 bg-dark-900/80 p-1 rounded-xl border border-white/10">
      <button onclick="setStreamMode('http')" id="tab-btn-http" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all bg-brand-500 text-black shadow">
        <i data-lucide="globe" class="w-3.5 h-3.5"></i>
        <span>REST / HTTP</span>
      </button>
      <button onclick="setStreamMode('mqtt')" id="tab-btn-mqtt" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all text-slate-400 hover:text-white">
        <i data-lucide="wifi" class="w-3.5 h-3.5"></i>
        <span>MQTT Cloud</span>
      </button>
      <button onclick="setStreamMode('serial')" id="tab-btn-serial" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all text-slate-400 hover:text-white">
        <i data-lucide="usb" class="w-3.5 h-3.5"></i>
        <span>USB Web Serial</span>
      </button>
      <button onclick="setStreamMode('sim')" id="tab-btn-sim" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all text-slate-400 hover:text-white">
        <i data-lucide="cpu" class="w-3.5 h-3.5"></i>
        <span>Simulator</span>
      </button>
    </div>

    <!-- Status & Actions -->
    <div class="flex items-center space-x-3">
      <div id="connection-badge" class="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-dark-900 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
        <span class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span>
        <span id="connection-status-text">Live Server Connected</span>
      </div>
      <button onclick="openFirmwareModal()" class="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition">
        <i data-lucide="code" class="w-4 h-4"></i>
        <span class="hidden sm:inline">ESP32 Code</span>
      </button>
    </div>
  </header>

  <!-- DASHBOARD MAIN -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">

    <!-- METRICS STRIP -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- V0 Temp -->
      <div class="glass-panel rounded-2xl p-4 relative overflow-hidden transition hover:translate-y-[-2px]">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-slate-400">PIN V0 • Temperature</span>
          <div class="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <i data-lucide="thermometer" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="mt-2 flex items-baseline space-x-1">
          <span id="metric-v0" class="text-3xl font-extrabold text-white tracking-tight font-mono">24.8</span>
          <span class="text-sm font-semibold text-slate-400">°C</span>
        </div>
        <div class="mt-3 flex items-center justify-between text-xs">
          <span class="text-slate-500">Range: 0 - 60°C</span>
          <span id="badge-v0" class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">NORMAL</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-dark-900">
          <div id="bar-v0" class="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300" style="width: 41%"></div>
        </div>
      </div>

      <!-- V1 Humidity -->
      <div class="glass-panel rounded-2xl p-4 relative overflow-hidden transition hover:translate-y-[-2px]">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-slate-400">PIN V1 • Humidity</span>
          <div class="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <i data-lucide="droplets" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="mt-2 flex items-baseline space-x-1">
          <span id="metric-v1" class="text-3xl font-extrabold text-white tracking-tight font-mono">58.5</span>
          <span class="text-sm font-semibold text-slate-400">%</span>
        </div>
        <div class="mt-3 flex items-center justify-between text-xs">
          <span class="text-slate-500">Range: 0 - 100%</span>
          <span id="badge-v1" class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">OPTIMAL</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-dark-900">
          <div id="bar-v1" class="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300" style="width: 58.5%"></div>
        </div>
      </div>

      <!-- V3 Light Intensity -->
      <div class="glass-panel rounded-2xl p-4 relative overflow-hidden transition hover:translate-y-[-2px]">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-slate-400">PIN V3 • Light Intensity</span>
          <div class="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <i data-lucide="sun" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="mt-2 flex items-baseline space-x-1">
          <span id="metric-v3" class="text-3xl font-extrabold text-white tracking-tight font-mono">128</span>
          <span class="text-sm font-semibold text-slate-400">lux</span>
        </div>
        <div class="mt-3 flex items-center justify-between text-xs">
          <span class="text-slate-500">Range: 0 - 255</span>
          <span id="badge-v3" class="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-mono">MODERATE</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-dark-900">
          <div id="bar-v3" class="h-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all duration-300" style="width: 50%"></div>
        </div>
      </div>

      <!-- V4 Voltage -->
      <div class="glass-panel rounded-2xl p-4 relative overflow-hidden transition hover:translate-y-[-2px]">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-slate-400">PIN V4 • ESP32 Voltage</span>
          <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <i data-lucide="zap" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="mt-2 flex items-baseline space-x-1">
          <span id="metric-v4" class="text-3xl font-extrabold text-white tracking-tight font-mono">3.82</span>
          <span class="text-sm font-semibold text-slate-400">V</span>
        </div>
        <div class="mt-3 flex items-center justify-between text-xs">
          <span class="text-slate-500">Target: 3.3V - 5.0V</span>
          <span id="badge-v4" class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">GOOD</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-dark-900">
          <div id="bar-v4" class="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300" style="width: 76%"></div>
        </div>
      </div>
    </div>

    <!-- CHART + GAUGES -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Live Stream Chart -->
      <div class="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <h2 class="text-base font-bold text-white flex items-center space-x-2">
              <i data-lucide="line-chart" class="w-5 h-5 text-brand-400"></i>
              <span>Live Sensor Stream</span>
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">Real-time telemetry stream from ESP32</p>
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="toggleStreamPause()" id="btn-pause-stream" class="px-3 py-1.5 rounded-lg bg-dark-900 hover:bg-dark-800 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1 transition">
              <i data-lucide="pause" id="icon-pause-stream" class="w-3.5 h-3.5"></i>
              <span id="text-pause-stream">Pause</span>
            </button>
            <button onclick="clearStreamData()" class="px-3 py-1.5 rounded-lg bg-dark-900 hover:bg-dark-800 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1 transition">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Clear</span>
            </button>
            <button onclick="exportStreamCSV()" class="px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-xs font-semibold text-brand-400 flex items-center space-x-1 transition">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div class="flex-1 relative min-h-[300px] mt-4">
          <canvas id="liveTelemetryChart"></canvas>
        </div>

        <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-400 animate-ping"></span>
            <span>Streaming Rate: <span id="telemetry-hz" class="text-white font-mono font-bold">1.0</span> updates/sec</span>
          </div>
          <div class="font-mono text-slate-500">
            REST Endpoint: <code class="text-brand-400">/api/blynk/update?V0=25.4</code>
          </div>
        </div>
      </div>

      <!-- Precision Dial Gauges & Relays -->
      <div class="glass-panel rounded-2xl p-6 flex flex-col space-y-6">
        <div>
          <h2 class="text-base font-bold text-white flex items-center space-x-2">
            <i data-lucide="gauge" class="w-5 h-5 text-brand-400"></i>
            <span>Precision Dial Gauges</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">Dual animated radial gauges</p>
        </div>

        <div class="grid grid-cols-2 gap-2 place-items-center">
          <div class="flex flex-col items-center">
            <canvas id="tempGaugeCanvas" width="140" height="140"></canvas>
            <span class="text-xs font-bold text-orange-400 mt-1">Temp (V0)</span>
          </div>
          <div class="flex flex-col items-center">
            <canvas id="humidityGaugeCanvas" width="140" height="140"></canvas>
            <span class="text-xs font-bold text-blue-400 mt-1">Humidity (V1)</span>
          </div>
        </div>

        <!-- Relays -->
        <div class="pt-4 border-t border-white/10 space-y-3">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Actuators & Relays</span>
          
          <!-- Relay 1 (V2) -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-dark-900/60 border border-white/5">
            <div class="flex items-center space-x-3">
              <div id="relay1-icon-box" class="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                <i data-lucide="power" class="w-4 h-4"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-white">Relay 1 (V2)</span>
                <p id="relay1-status-text" class="text-[11px] text-slate-400">OFF (0)</p>
              </div>
            </div>
            <button onclick="toggleRelay('V2')" id="btn-relay-v2" class="px-4 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs font-bold border border-white/10 transition">
              SWITCH
            </button>
          </div>

          <!-- Relay 2 (V5) -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-dark-900/60 border border-white/5">
            <div class="flex items-center space-x-3">
              <div id="relay2-icon-box" class="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                <i data-lucide="lightbulb" class="w-4 h-4"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-white">Lighting (V5)</span>
                <p id="relay2-status-text" class="text-[11px] text-slate-400">OFF (0)</p>
              </div>
            </div>
            <button onclick="toggleRelay('V5')" id="btn-relay-v5" class="px-4 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs font-bold border border-white/10 transition">
              SWITCH
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- PIN MATRIX & TERMINAL -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Virtual Pin Matrix (V0 to V15) -->
      <div class="lg:col-span-2 glass-panel rounded-2xl p-6">
        <div class="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 class="text-base font-bold text-white flex items-center space-x-2">
              <i data-lucide="grid" class="w-5 h-5 text-brand-400"></i>
              <span>Virtual Pin Inspector (V0 – V15)</span>
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">Click any pin to inspect or override</p>
          </div>
        </div>

        <div class="grid grid-cols-4 sm:grid-cols-8 gap-2.5 mt-4" id="pin-matrix-grid"></div>

        <!-- Quick Override -->
        <div class="mt-5 p-3.5 rounded-xl bg-dark-900/60 border border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold text-slate-300">Quick Write:</span>
            <select id="quick-pin-select" class="bg-dark-850 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 font-mono">
              <option value="V0">V0 (Temp)</option>
              <option value="V1">V1 (Humidity)</option>
              <option value="V2">V2 (Relay 1)</option>
              <option value="V3">V3 (Light)</option>
              <option value="V4">V4 (Voltage)</option>
              <option value="V5">V5 (Lighting)</option>
              <option value="V6">V6 (Generic)</option>
              <option value="V7">V7 (Generic)</option>
            </select>
            <input type="text" id="quick-pin-value" placeholder="Value (e.g. 42.5)" class="bg-dark-850 text-white text-xs rounded-lg px-3 py-1.5 border border-white/10 font-mono w-28 focus:outline-none focus:border-brand-500">
          </div>
          <button onclick="sendQuickPinWrite()" class="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-black text-xs font-bold transition flex items-center space-x-1">
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
            <span>Push Value</span>
          </button>
        </div>
      </div>

      <!-- Live Terminal -->
      <div class="glass-panel rounded-2xl p-6 flex flex-col">
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
          <div class="flex items-center space-x-2">
            <i data-lucide="terminal" class="w-4 h-4 text-brand-400"></i>
            <span class="text-sm font-bold text-white">Stream Terminal</span>
          </div>
          <button onclick="clearTerminalLogs()" class="text-slate-400 hover:text-white text-xs flex items-center space-x-1">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
            <span>Clear</span>
          </button>
        </div>

        <div id="terminal-log" class="flex-1 min-h-[220px] max-h-[220px] overflow-y-auto mt-3 p-3 rounded-xl bg-black/60 border border-white/5 font-mono text-[11px] space-y-1 custom-scrollbar text-slate-300">
          <div class="text-emerald-400 font-bold">[SYSTEM] Clynk Engine Initialized.</div>
          <div class="text-slate-500">[STREAM] Ready to receive ESP32 Telemetry.</div>
        </div>

        <div class="mt-3 flex items-center space-x-2">
          <input type="text" id="terminal-input" placeholder="Type serial command or MQTT topic..." class="flex-1 bg-dark-900 text-white text-xs rounded-lg px-3 py-2 border border-white/10 font-mono focus:outline-none focus:border-brand-500" onkeydown="if(event.key==='Enter') sendTerminalCommand()">
          <button onclick="sendTerminalCommand()" class="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-white border border-white/10 transition">
            <i data-lucide="corner-down-left" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

    </div>

  </main>

  <!-- MODAL: ESP32 CODE GENERATOR -->
  <div id="firmware-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4">
    <div class="glass-panel rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-white/15 shadow-2xl">
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center space-x-2">
          <i data-lucide="cpu" class="w-5 h-5 text-indigo-400"></i>
          <h3 class="text-base font-bold text-white">ESP32 Arduino Firmware Code (HTTP / REST)</h3>
        </div>
        <button onclick="closeFirmwareModal()" class="text-slate-400 hover:text-white p-1">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <p class="text-xs text-slate-400">
        Copy this sketch into Arduino IDE. It uses standard HTTP GET requests to stream data directly to your Clynk Cloud endpoint!
      </p>

      <div class="relative">
        <pre class="bg-black/90 p-4 rounded-xl text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-[340px] custom-scrollbar border border-white/10" id="esp32-code-box">
#include &lt;WiFi.h&gt;
#include &lt;HTTPClient.h&gt;

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Your Clynk Cloud Deployment URL
const char* serverUrl = "https://clynk.vercel.app/api/blynk/update";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Read or simulate sensor values
    float temp = 24.5 + (random(0, 30) / 10.0);
    float hum = 55.0 + (random(0, 50) / 10.0);
    float volt = 3.8 + (random(-10, 10) / 100.0);

    String url = String(serverUrl) + "?V0=" + String(temp, 1) + "&V1=" + String(hum, 1) + "&V4=" + String(volt, 2);
    
    http.begin(url);
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      Serial.printf("HTTP %d | Sent: Temp=%.1f C, Hum=%.1f %%\n", httpResponseCode, temp, hum);
    }
    http.end();
  }
  
  delay(1000); // Send every 1 second
}</pre>
        <button onclick="copyFirmwareCode()" id="btn-copy-code" class="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-white text-xs font-bold border border-white/20 flex items-center space-x-1.5 transition">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          <span id="copy-code-text">Copy Code</span>
        </button>
      </div>

      <div class="pt-2 flex justify-end">
        <button onclick="closeFirmwareModal()" class="px-4 py-2 rounded-xl bg-brand-500 text-black text-xs font-bold hover:bg-brand-400 transition">Done</button>
      </div>
    </div>
  </div>

  <!-- SCRIPT -->
  <script>
    const state = {
      streamMode: 'http',
      isPaused: false,
      serialPort: null,
      mqttClient: null,
      simInterval: null,
      pollInterval: null,
      packetCount: 0,
      pins: {
        V0: 24.8, V1: 58.5, V2: 0, V3: 128, V4: 3.82, V5: 0,
        V6: 0, V7: 0, V8: 0, V9: 0, V10: 0, V11: 0, V12: 0, V13: 0, V14: 0, V15: 0
      }
    };

    let telemetryChart = null, tempGauge = null, humGauge = null;

    window.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();
      initPinMatrix();
      initChart();
      initGauges();
      startHttpPolling();

      setInterval(() => {
        const hz = state.packetCount;
        state.packetCount = 0;
        const el = document.getElementById('telemetry-hz');
        if (el) el.innerText = hz.toFixed(1);
      }, 1000);
    });

    function setStreamMode(mode) {
      state.streamMode = mode;
      ['http', 'mqtt', 'serial', 'sim'].forEach(m => {
        const btn = document.getElementById('tab-btn-' + m);
        if (btn) btn.className = (m === mode) 
          ? 'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all bg-brand-500 text-black shadow'
          : 'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all text-slate-400 hover:text-white';
      });

      if (state.simInterval) { clearInterval(state.simInterval); state.simInterval = null; }
      if (state.pollInterval) { clearInterval(state.pollInterval); state.pollInterval = null; }

      if (mode === 'http') startHttpPolling();
      if (mode === 'mqtt') startMQTTStream();
      if (mode === 'serial') startSerialStream();
      if (mode === 'sim') startSimulatorStream();
    }

    function startHttpPolling() {
      logTerminal('[MODE] REST / HTTP Polling Active', 'emerald');
      state.pollInterval = setInterval(async () => {
        if (state.isPaused) return;
        try {
          const res = await fetch('/api/pins');
          if (res.ok) {
            const data = await res.json();
            if (data.pins) {
              state.packetCount++;
              for (const [k, v] of Object.entries(data.pins)) {
                state.pins[k] = isNaN(Number(v)) ? v : Number(v);
                updateDashboardUI(k);
              }
            }
          }
        } catch (e) {}
      }, 1000);
    }

    function startMQTTStream() {
      logTerminal('[MQTT] Connecting to broker.emqx.io...', 'slate');
      try {
        const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: 'clynk_' + Math.random().toString(16).slice(2,8) });
        state.mqttClient = client;
        client.on('connect', () => {
          client.subscribe('clynk/device1/#');
          logTerminal('[MQTT] Subscribed to clynk/device1/#', 'emerald');
        });
        client.on('message', (topic, payload) => {
          state.packetCount++;
          const pin = topic.split('/').pop().toUpperCase();
          const val = payload.toString();
          if (state.pins.hasOwnProperty(pin)) {
            state.pins[pin] = isNaN(Number(val)) ? val : Number(val);
            updateDashboardUI(pin);
          }
        });
      } catch (e) { logTerminal('[MQTT Error] ' + e.message, 'red'); }
    }

    async function startSerialStream() {
      if (!('serial' in navigator)) {
        alert('Web Serial is supported in Chrome/Edge. Please connect via USB on Chrome/Edge.');
        return;
      }
      try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        state.serialPort = port;
        logTerminal('[SERIAL] Connected at 115200 baud', 'emerald');
        const decoder = new TextDecoderStream();
        port.readable.pipeTo(decoder.writable);
        const reader = decoder.readable.getReader();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            buf += value;
            const lines = buf.split('\\n');
            buf = lines.pop();
            for (const line of lines) {
              const match = line.match(/(V\\d+)\\s*[:=]\\s*([0-9.-]+)/i);
              if (match) {
                const pin = match[1].toUpperCase(), val = parseFloat(match[2]);
                if (state.pins.hasOwnProperty(pin)) {
                  state.pins[pin] = val;
                  updateDashboardUI(pin);
                }
              }
            }
          }
        }
      } catch (e) { logTerminal('[SERIAL Error] ' + e.message, 'red'); }
    }

    function startSimulatorStream() {
      logTerminal('[SIM] Virtual ESP32 Simulator Started', 'cyan');
      let t = 0;
      state.simInterval = setInterval(() => {
        if (state.isPaused) return;
        state.packetCount++;
        t += 0.1;
        state.pins.V0 = parseFloat((24.0 + Math.sin(t)*3.5 + Math.random()*0.3).toFixed(1));
        state.pins.V1 = parseFloat((55.0 + Math.cos(t*0.8)*8.0 + Math.random()*0.5).toFixed(1));
        state.pins.V3 = Math.floor(120 + Math.sin(t*0.5)*40);
        state.pins.V4 = parseFloat((3.8 + Math.sin(t*0.2)*0.15).toFixed(2));
        updateDashboardUI('V0');
        updateDashboardUI('V1');
        updateDashboardUI('V3');
        updateDashboardUI('V4');
      }, 1000);
    }

    function updateDashboardUI(pin) {
      const val = state.pins[pin];
      if (pin === 'V0') {
        const el = document.getElementById('metric-v0'); if (el) el.innerText = Number(val).toFixed(1);
        const bar = document.getElementById('bar-v0'); if (bar) bar.style.width = Math.min(100, Math.max(0, (val/60)*100)) + '%';
        if (tempGauge) tempGauge.value = val;
      }
      if (pin === 'V1') {
        const el = document.getElementById('metric-v1'); if (el) el.innerText = Number(val).toFixed(1);
        const bar = document.getElementById('bar-v1'); if (bar) bar.style.width = Math.min(100, Math.max(0, val)) + '%';
        if (humGauge) humGauge.value = val;
      }
      if (pin === 'V3') {
        const el = document.getElementById('metric-v3'); if (el) el.innerText = Math.round(val);
        const bar = document.getElementById('bar-v3'); if (bar) bar.style.width = Math.min(100, Math.max(0, (val/255)*100)) + '%';
      }
      if (pin === 'V4') {
        const el = document.getElementById('metric-v4'); if (el) el.innerText = Number(val).toFixed(2);
        const bar = document.getElementById('bar-v4'); if (bar) bar.style.width = Math.min(100, Math.max(0, (val/5.0)*100)) + '%';
      }
      if (pin === 'V2') {
        const active = Number(val) > 0;
        const box = document.getElementById('relay1-icon-box'), txt = document.getElementById('relay1-status-text');
        if (box) box.className = active ? 'w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center' : 'w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400';
        if (txt) txt.innerText = active ? 'ON (1)' : 'OFF (0)';
      }
      if (pin === 'V5') {
        const active = Number(val) > 0;
        const box = document.getElementById('relay2-icon-box'), txt = document.getElementById('relay2-status-text');
        if (box) box.className = active ? 'w-9 h-9 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 flex items-center justify-center' : 'w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400';
        if (txt) txt.innerText = active ? 'ON (1)' : 'OFF (0)';
      }
      const matrixVal = document.getElementById('pin-val-' + pin);
      if (matrixVal) matrixVal.innerText = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val;

      if (telemetryChart && (pin === 'V0' || pin === 'V1')) {
        const now = new Date().toLocaleTimeString();
        if (telemetryChart.data.labels.length > 25) {
          telemetryChart.data.labels.shift();
          telemetryChart.data.datasets[0].data.shift();
          telemetryChart.data.datasets[1].data.shift();
        }
        telemetryChart.data.labels.push(now);
        telemetryChart.data.datasets[0].data.push(state.pins.V0);
        telemetryChart.data.datasets[1].data.push(state.pins.V1);
        telemetryChart.update('none');
      }
    }

    function initChart() {
      const ctx = document.getElementById('liveTelemetryChart').getContext('2d');
      telemetryChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['10:00', '10:01', '10:02', '10:03', '10:04'],
          datasets: [
            { label: 'Temp (°C)', data: [24.5, 24.6, 24.8, 24.7, 24.8], borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.15)', fill: true, tension: 0.35, borderWidth: 2.5 },
            { label: 'Humidity (%)', data: [58.0, 58.2, 58.5, 58.4, 58.5], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)', fill: true, tension: 0.35, borderWidth: 2.5 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } } }
          }
        }
      });
    }

    function initGauges() {
      tempGauge = new RadialGauge({
        renderTo: 'tempGaugeCanvas', width: 140, height: 140, units: '°C', minValue: 0, maxValue: 60, value: 24.8,
        majorTicks: ['0', '15', '30', '45', '60'], colorPlate: 'transparent', colorUnits: '#f97316', colorNumbers: '#cbd5e1', colorNeedle: '#f97316', borders: false
      }).draw();
      humGauge = new RadialGauge({
        renderTo: 'humidityGaugeCanvas', width: 140, height: 140, units: '%', minValue: 0, maxValue: 100, value: 58.5,
        majorTicks: ['0', '25', '50', '75', '100'], colorPlate: 'transparent', colorUnits: '#3b82f6', colorNumbers: '#cbd5e1', colorNeedle: '#3b82f6', borders: false
      }).draw();
    }

    function initPinMatrix() {
      const grid = document.getElementById('pin-matrix-grid');
      grid.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const pin = 'V' + i, val = state.pins[pin];
        const card = document.createElement('div');
        card.className = 'p-3 rounded-xl bg-dark-900/80 border border-white/5 hover:border-brand-500/40 transition cursor-pointer flex flex-col justify-between';
        card.onclick = () => {
          document.getElementById('quick-pin-select').value = pin;
          document.getElementById('quick-pin-value').focus();
        };
        card.innerHTML = '<div class="flex items-center justify-between"><span class="text-[11px] font-bold text-slate-400">' + pin + '</span></div><div class="mt-2 text-base font-extrabold text-white font-mono" id="pin-val-' + pin + '">' + val + '</div>';
        grid.appendChild(card);
      }
    }

    function toggleRelay(pin) {
      const next = (Number(state.pins[pin]) || 0) > 0 ? 0 : 1;
      state.pins[pin] = next;
      updateDashboardUI(pin);
      fetch('/api/blynk/update?pin=' + pin + '&value=' + next).catch(() => {});
    }

    function sendQuickPinWrite() {
      const pin = document.getElementById('quick-pin-select').value;
      const raw = document.getElementById('quick-pin-value').value.trim();
      if (!raw) return;
      state.pins[pin] = raw;
      updateDashboardUI(pin);
      fetch('/api/blynk/update?pin=' + pin + '&value=' + encodeURIComponent(raw)).catch(() => {});
      document.getElementById('quick-pin-value').value = '';
    }

    function logTerminal(msg, color = 'slate') {
      const term = document.getElementById('terminal-log');
      if (!term) return;
      const div = document.createElement('div');
      div.className = (color === 'emerald') ? 'text-emerald-400 font-semibold' : (color === 'red') ? 'text-red-400' : 'text-slate-300';
      div.innerText = '[' + new Date().toLocaleTimeString() + '] ' + msg;
      term.appendChild(div);
      term.scrollTop = term.scrollHeight;
    }

    function clearTerminalLogs() {
      document.getElementById('terminal-log').innerHTML = '<div class="text-slate-500">[TERMINAL] Logs cleared.</div>';
    }

    function toggleStreamPause() {
      state.isPaused = !state.isPaused;
      document.getElementById('text-pause-stream').innerText = state.isPaused ? 'Resume' : 'Pause';
    }

    function clearStreamData() {
      if (telemetryChart) {
        telemetryChart.data.labels = [];
        telemetryChart.data.datasets[0].data = [];
        telemetryChart.data.datasets[1].data = [];
        telemetryChart.update();
      }
    }

    function exportStreamCSV() {
      if (!telemetryChart || !telemetryChart.data.labels.length) return alert('No data to export!');
      let csv = 'Timestamp,Temperature_C,Humidity_Percent\\n';
      for (let i = 0; i < telemetryChart.data.labels.length; i++) {
        csv += '"' + telemetryChart.data.labels[i] + '",' + (telemetryChart.data.datasets[0].data[i] || '') + ',' + (telemetryChart.data.datasets[1].data[i] || '') + '\\n';
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'clynk_telemetry.csv';
      a.click();
    }

    function openFirmwareModal() { document.getElementById('firmware-modal').classList.remove('hidden'); document.getElementById('firmware-modal').classList.add('flex'); }
    function closeFirmwareModal() { document.getElementById('firmware-modal').classList.add('hidden'); document.getElementById('firmware-modal').classList.remove('flex'); }
    function copyFirmwareCode() {
      navigator.clipboard.writeText(document.getElementById('esp32-code-box').innerText).then(() => {
        document.getElementById('copy-code-text').innerText = 'Copied! ✓';
        setTimeout(() => document.getElementById('copy-code-text').innerText = 'Copy Code', 2000);
      });
    }
  </script>
</body>
</html>`;

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

// --- API Route 3: /api/pins (Returns all pins as JSON) ---
app.get('/api/pins', (req, res) => {
  const pinsObj = Object.fromEntries(pinStore);
  return res.json({ success: true, pins: pinsObj });
});

// --- API Route 4: /api/ai/query ---
app.all('/api/ai/query', (req, res) => {
  return res.json({
    title: 'Telemetry Trend',
    insights: `📊 Telemetry nominal. V0: ${pinStore.get('V0')}°C, V1: ${pinStore.get('V1')}%.`,
    actions: [],
    data: []
  });
});

// --- API Route 5: Health Check ---
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Root Route: Serve Embedded Standalone Dashboard HTML directly ---
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(DASHBOARD_HTML);
});

// If run directly (node server.js), start listening on port 3000
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Clynk Server running on http://localhost:${PORT}`);
  });
}

export default app;
