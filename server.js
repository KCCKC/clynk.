import express from 'express';
import cors from 'cors';

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

// In-memory historical buffer for time-series charts
const historyLogs = {
  V0: [],
  V1: [],
  V2: [],
  V3: [],
  V6: [],
  V7: []
};

// Seed initial history
const nowTs = Date.now();
for (let i = 20; i >= 0; i--) {
  const t = new Date(nowTs - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  historyLogs.V0.push({ time: t, val: 27.5 + (Math.sin(i * 0.4) * 1.5) });
  historyLogs.V1.push({ time: t, val: 86.0 + (Math.cos(i * 0.3) * 4.0) });
  historyLogs.V2.push({ time: t, val: 0 });
  historyLogs.V3.push({ time: t, val: 1 });
  historyLogs.V6.push({ time: t, val: 45.0 + (Math.sin(i * 0.2) * 2.0) });
  historyLogs.V7.push({ time: t, val: 320 + Math.floor(Math.sin(i * 0.5) * 50) });
}

// --- Embedded Authentic Blynk 2.0 Console HTML ---
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blynk.Console • IoT Farming System</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS CDN -->
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
            blynk: {
              DEFAULT: '#00c282',
              50: '#e6faf2',
              100: '#cbf5e4',
              400: '#33d39f',
              500: '#00c282',
              600: '#00a36d',
              700: '#008559',
              dark: '#111827',
              gray: '#f3f4f6',
              border: '#e5e7eb',
            }
          }
        }
      }
    }
  </script>
  
  <!-- Chart.js, MQTT.js, Lucide Icons -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>

  <style>
    body {
      background-color: #f8fafc;
      color: #1e293b;
    }
    .dark body {
      background-color: #0b0f19;
      color: #e2e8f0;
    }
    .blynk-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
    }
    .dark .blynk-card {
      background: #111827;
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .blynk-card:hover {
      border-color: #cbd5e1;
    }
    .dark .blynk-card:hover {
      border-color: rgba(0, 194, 130, 0.3);
    }
    .blynk-tab.active {
      color: #00c282;
      border-bottom: 2px solid #00c282;
      font-weight: 700;
    }
    .time-btn.active {
      background-color: #00c282;
      color: #ffffff;
      font-weight: 600;
    }
    .gauge-arc {
      transform: rotate(-90deg);
      transform-origin: 50% 50%;
      transition: stroke-dashoffset 0.6s ease;
    }
    .custom-scroll::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .custom-scroll::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col font-sans">

  <!-- TOP APP BAR -->
  <header class="bg-white dark:bg-[#0e1422] border-b border-slate-200 dark:border-white/10 px-4 lg:px-6 py-2.5 flex items-center justify-between sticky top-0 z-40">
    <div class="flex items-center space-x-4">
      <!-- Blynk Logo Mark -->
      <div class="w-8 h-8 rounded-lg bg-[#00c282] flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
        B
      </div>
      <div class="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span class="hover:text-slate-800 dark:hover:text-white cursor-pointer">Devices</span>
        <span>/</span>
        <span id="nav-device-title" class="font-semibold text-slate-800 dark:text-slate-200">Iot farming system 001</span>
      </div>
    </div>

    <!-- Center Search & Filter -->
    <div class="flex items-center space-x-2">
      <div class="hidden md:flex items-center bg-slate-100 dark:bg-dark-800 rounded-lg px-3 py-1.5 border border-slate-200 dark:border-white/5 text-xs">
        <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 mr-2"></i>
        <input type="text" placeholder="Search datastreams, pins..." class="bg-transparent focus:outline-none text-slate-700 dark:text-slate-200 w-44 font-sans text-xs">
      </div>
    </div>

    <!-- Actions & Status -->
    <div class="flex items-center space-x-3">
      <!-- Live Stream Mode Selector -->
      <div class="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-white/5">
        <button onclick="setStreamMode('mqtt')" id="mode-btn-mqtt" class="px-2.5 py-1 rounded-md bg-[#00c282] text-white shadow-sm transition">MQTT Stream</button>
        <button onclick="setStreamMode('http')" id="mode-btn-http" class="px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition">HTTP Polling</button>
        <button onclick="setStreamMode('sim')" id="mode-btn-sim" class="px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition">Simulator</button>
      </div>

      <!-- Online status pill -->
      <div id="status-badge" class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-[#00c282] text-xs font-bold">
        <span class="w-2 h-2 rounded-full bg-[#00c282] animate-pulse"></span>
        <span id="status-text">ONLINE</span>
      </div>

      <button onclick="openDeviceSettingsModal()" class="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Edit Device Details">
        <i data-lucide="more-horizontal" class="w-5 h-5"></i>
      </button>
      <button onclick="toggleDarkMode()" class="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Toggle Dark/Light Mode">
        <i data-lucide="moon" class="w-4 h-4"></i>
      </button>
    </div>
  </header>

  <!-- DEVICE HERO SUBHEADER -->
  <div class="bg-white dark:bg-[#0e1422] border-b border-slate-200 dark:border-white/10 px-4 lg:px-8 pt-5 pb-0">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-start space-x-3.5">
        <div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
          <i data-lucide="box" class="w-6 h-6 text-[#00c282]"></i>
        </div>
        <div>
          <div class="flex items-center space-x-3">
            <h1 id="device-title" class="text-xl font-bold text-slate-900 dark:text-white">Iot farming system 001</h1>
            <span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-[#00c282] border border-emerald-200 dark:border-emerald-800/40">ONLINE</span>
            <button onclick="openDeviceSettingsModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <div class="flex items-center space-x-1">
              <i data-lucide="user" class="w-3.5 h-3.5"></i>
              <span id="device-owner">Lee</span>
            </div>
            <div class="flex items-center space-x-1">
              <i data-lucide="map-pin" class="w-3.5 h-3.5"></i>
              <span id="device-location">Farm Villa</span>
            </div>
            <div class="flex items-center space-x-1">
              <i data-lucide="cpu" class="w-3.5 h-3.5 text-[#00c282]"></i>
              <span id="device-model" class="font-mono text-slate-700 dark:text-slate-300 font-semibold">ESP32 DevKit V1</span>
            </div>
            <button onclick="addTagPrompt()" class="text-[#00c282] hover:underline font-semibold flex items-center space-x-0.5">
              <i data-lucide="tag" class="w-3 h-3"></i>
              <span>+ Add Tag</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Template Actions -->
      <div class="flex items-center space-x-2 pb-2 md:pb-0">
        <button onclick="openCustomizeModal()" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 flex items-center space-x-1.5 transition">
          <i data-lucide="layout" class="w-3.5 h-3.5 text-[#00c282]"></i>
          <span>Customize Layout</span>
        </button>
        <button onclick="saveCurrentTemplate()" class="px-3 py-1.5 rounded-lg bg-[#00c282] hover:bg-[#00a36d] text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition">
          <i data-lucide="bookmark" class="w-3.5 h-3.5"></i>
          <span>Save as Template</span>
        </button>
      </div>
    </div>

    <!-- BLYNK MAIN NAVIGATION TABS -->
    <div class="max-w-7xl mx-auto flex items-center space-x-8 mt-5 border-t border-slate-100 dark:border-white/5 overflow-x-auto text-xs font-medium">
      <button onclick="switchTab('dashboard')" id="tab-btn-dashboard" class="blynk-tab active py-3 text-slate-600 dark:text-slate-400 hover:text-[#00c282] flex items-center space-x-1.5">
        <i data-lucide="layout-grid" class="w-4 h-4"></i>
        <span>Dashboard</span>
      </button>
      <button onclick="switchTab('datastreams')" id="tab-btn-datastreams" class="blynk-tab py-3 text-slate-600 dark:text-slate-400 hover:text-[#00c282] flex items-center space-x-1.5">
        <i data-lucide="layers" class="w-4 h-4"></i>
        <span>Datastreams</span>
      </button>
      <button onclick="switchTab('deviceinfo')" id="tab-btn-deviceinfo" class="blynk-tab py-3 text-slate-600 dark:text-slate-400 hover:text-[#00c282] flex items-center space-x-1.5">
        <i data-lucide="info" class="w-4 h-4"></i>
        <span>Device Info</span>
      </button>
      <button onclick="switchTab('firmware')" id="tab-btn-firmware" class="blynk-tab py-3 text-slate-600 dark:text-slate-400 hover:text-[#00c282] flex items-center space-x-1.5">
        <i data-lucide="code-2" class="w-4 h-4"></i>
        <span>ESP32 Firmware</span>
      </button>
    </div>
  </div>

  <!-- MAIN BODY CONTAINER -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">

    <!-- TAB 1: DASHBOARD VIEW -->
    <div id="view-dashboard" class="space-y-5">
      
      <!-- TIME FILTER TOOLBAR (Blynk Style) -->
      <div class="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0e1422] p-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
        <div class="flex items-center space-x-1 overflow-x-auto">
          <button onclick="setTimeFilter('latest')" id="tbtn-latest" class="time-btn active px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 transition">Latest</button>
          <button onclick="setTimeFilter('1h')" id="tbtn-1h" class="time-btn px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Last Hour</button>
          <button onclick="setTimeFilter('6h')" id="tbtn-6h" class="time-btn px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">6 Hours</button>
          <button onclick="setTimeFilter('1d')" id="tbtn-1d" class="time-btn px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">1 Day</button>
          <button onclick="setTimeFilter('1w')" id="tbtn-1w" class="time-btn px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">1 Week</button>
          <button onclick="setTimeFilter('1m')" id="tbtn-1m" class="time-btn px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">1 Month</button>
          <button onclick="setTimeFilter('3m')" id="tbtn-3m" class="time-btn px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">3 Months</button>
        </div>

        <div class="flex items-center space-x-2 text-slate-500 text-xs font-mono">
          <span>Rate: <b id="packet-rate-hz" class="text-emerald-500">1.0</b> Hz</span>
          <span>•</span>
          <button onclick="exportCSVData()" class="hover:text-emerald-600 flex items-center space-x-1 font-sans font-semibold">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Export</span>
          </button>
        </div>
      </div>

      <!-- MAIN WIDGET GRID (Matches User Screenshot: 2 Columns of [Gauge | Chart] & [Switch | Chart]) -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-5" id="dashboard-widget-container">
        
        <!-- ROW 1, COL 1: TEMPERATURE (V0) GAUGE + CHART -->
        <div class="xl:col-span-4 blynk-card p-5 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">TEMPERATURE (V0)</span>
            <span class="text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-bold">STREAMING</span>
          </div>

          <!-- Circular SVG Gauge -->
          <div class="relative flex items-center justify-center my-3">
            <svg class="w-40 h-40" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="8" stroke-dasharray="188.5" stroke-dashoffset="0" class="dark:stroke-slate-800" stroke-linecap="round" transform="rotate(135 50 50)"/>
              <circle id="gauge-arc-v0" cx="50" cy="50" r="40" fill="none" stroke="#facc15" stroke-width="8" stroke-dasharray="188.5" stroke-dashoffset="99" stroke-linecap="round" transform="rotate(135 50 50)" class="gauge-arc"/>
            </svg>
            <div class="absolute text-center">
              <span id="gauge-val-v0" class="text-3xl font-extrabold font-mono text-slate-800 dark:text-white">28.3</span>
              <span class="text-sm font-semibold text-slate-400">°C</span>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-slate-400 font-mono border-t border-slate-100 dark:border-white/5 pt-2">
            <span>0 °C</span>
            <span>Max 60 °C</span>
          </div>
        </div>

        <!-- ROW 1, COL 2: TEMPERATURE CHART -->
        <div class="xl:col-span-8 blynk-card p-5 flex flex-col justify-between">
          <div class="flex items-center justify-between pb-2">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Temperature Chart</span>
            </div>
            <span class="text-xs text-slate-400 font-mono">PIN V0 • Live History</span>
          </div>
          <div class="relative h-44 w-full">
            <canvas id="chart-v0"></canvas>
          </div>
        </div>

        <!-- ROW 2, COL 1: HUMIDITY (V1) GAUGE + CHART -->
        <div class="xl:col-span-4 blynk-card p-5 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">HUMIDITY (V1)</span>
            <span class="text-[10px] font-mono text-blue-500 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded font-bold">OPTIMAL</span>
          </div>

          <!-- Circular SVG Gauge -->
          <div class="relative flex items-center justify-center my-3">
            <svg class="w-40 h-40" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="8" stroke-dasharray="188.5" stroke-dashoffset="0" class="dark:stroke-slate-800" stroke-linecap="round" transform="rotate(135 50 50)"/>
              <circle id="gauge-arc-v1" cx="50" cy="50" r="40" fill="none" stroke="#0284c7" stroke-width="8" stroke-dasharray="188.5" stroke-dashoffset="20" stroke-linecap="round" transform="rotate(135 50 50)" class="gauge-arc"/>
            </svg>
            <div class="absolute text-center">
              <span id="gauge-val-v1" class="text-3xl font-extrabold font-mono text-slate-800 dark:text-white">89</span>
              <span class="text-sm font-semibold text-slate-400">%</span>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-slate-400 font-mono border-t border-slate-100 dark:border-white/5 pt-2">
            <span>0 %</span>
            <span>Max 100 %</span>
          </div>
        </div>

        <!-- ROW 2, COL 2: HUMIDITY CHART -->
        <div class="xl:col-span-8 blynk-card p-5 flex flex-col justify-between">
          <div class="flex items-center justify-between pb-2">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Humidity Chart</span>
            </div>
            <span class="text-xs text-slate-400 font-mono">PIN V1 • Live History</span>
          </div>
          <div class="relative h-44 w-full">
            <canvas id="chart-v1"></canvas>
          </div>
        </div>

        <!-- ROW 3, COL 1: SOIL MOISTURE (V6) GAUGE -->
        <div class="xl:col-span-4 blynk-card p-5 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">SOIL MOISTURE (V6)</span>
            <span class="text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-bold">NORMAL</span>
          </div>

          <!-- Circular SVG Gauge -->
          <div class="relative flex items-center justify-center my-3">
            <svg class="w-40 h-40" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="8" stroke-dasharray="188.5" stroke-dashoffset="0" class="dark:stroke-slate-800" stroke-linecap="round" transform="rotate(135 50 50)"/>
              <circle id="gauge-arc-v6" cx="50" cy="50" r="40" fill="none" stroke="#00c282" stroke-width="8" stroke-dasharray="188.5" stroke-dashoffset="102" stroke-linecap="round" transform="rotate(135 50 50)" class="gauge-arc"/>
            </svg>
            <div class="absolute text-center">
              <span id="gauge-val-v6" class="text-3xl font-extrabold font-mono text-slate-800 dark:text-white">46</span>
              <span class="text-sm font-semibold text-slate-400">%</span>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-slate-400 font-mono border-t border-slate-100 dark:border-white/5 pt-2">
            <span>0 %</span>
            <span>Max 100 %</span>
          </div>
        </div>

        <!-- ROW 3, COL 2: SOIL MOISTURE CHART -->
        <div class="xl:col-span-8 blynk-card p-5 flex flex-col justify-between">
          <div class="flex items-center justify-between pb-2">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#00c282]"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Soil Moisture Chart</span>
            </div>
            <span class="text-xs text-slate-400 font-mono">PIN V6 • Live History</span>
          </div>
          <div class="relative h-44 w-full">
            <canvas id="chart-v6"></canvas>
          </div>
        </div>

        <!-- ROW 4: ACTUATORS & SWITCHES (Water Pump V3 & Alarm V2) -->
        <div class="xl:col-span-6 blynk-card p-5 flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div id="pump-icon-box" class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-[#00c282] border border-emerald-500/30 flex items-center justify-center">
              <i data-lucide="waves" class="w-7 h-7"></i>
            </div>
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">ACTUATOR • PIN V3</span>
              <h3 class="text-base font-extrabold text-slate-800 dark:text-white">Water Pump</h3>
              <p id="pump-status-label" class="text-xs font-semibold text-emerald-600 mt-0.5">STATUS: RUNNING (1)</p>
            </div>
          </div>
          <button onclick="toggleActuator('V3')" id="btn-toggle-v3" class="px-5 py-2.5 rounded-xl bg-[#00c282] hover:bg-[#00a36d] text-white text-xs font-bold shadow-md transition">
            SWITCH OFF
          </button>
        </div>

        <div class="xl:col-span-6 blynk-card p-5 flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div id="alarm-icon-box" class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-white/10 flex items-center justify-center">
              <i data-lucide="bell" class="w-7 h-7"></i>
            </div>
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">ALERT SYSTEM • PIN V2</span>
              <h3 class="text-base font-extrabold text-slate-800 dark:text-white">System Siren / Alarm</h3>
              <p id="alarm-status-label" class="text-xs font-semibold text-slate-400 mt-0.5">STATUS: IDLE (0)</p>
            </div>
          </div>
          <button onclick="toggleActuator('V2')" id="btn-toggle-v2" class="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold border border-slate-300 dark:border-white/10 transition">
            ACTIVATE
          </button>
        </div>

      </div>
    </div>

    <!-- TAB 2: DATASTREAMS VIEW (Blynk Datastreams Manager) -->
    <div id="view-datastreams" class="hidden space-y-5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Virtual Datastreams Manager</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Map specific ports, units, and min/max boundaries just like Blynk</p>
        </div>
        <button onclick="openNewDatastreamModal()" class="px-4 py-2 rounded-xl bg-[#00c282] hover:bg-[#00a36d] text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>New Datastream</span>
        </button>
      </div>

      <div class="blynk-card overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/10 text-slate-500 font-semibold uppercase text-[10px]">
            <tr>
              <th class="p-3.5 pl-5">Pin / Port</th>
              <th class="p-3.5">Datastream Name</th>
              <th class="p-3.5">Data Type</th>
              <th class="p-3.5">Unit</th>
              <th class="p-3.5">Min - Max</th>
              <th class="p-3.5">Current Value</th>
              <th class="p-3.5 text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody id="datastreams-table-body" class="divide-y divide-slate-100 dark:divide-white/5 font-mono">
            <!-- Populated dynamically -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: DEVICE INFO VIEW -->
    <div id="view-deviceinfo" class="hidden space-y-5">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="blynk-card p-6 space-y-4">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-2">Hardware Specification</h3>
          <div class="space-y-3 text-xs">
            <div class="flex justify-between"><span class="text-slate-500">Device Model:</span><span id="info-model" class="font-bold text-slate-800 dark:text-white">ESP32 DevKit V1</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Firmware Build:</span><span class="font-mono text-emerald-600">v2.4.0-clynk-stable</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Connection Protocol:</span><span id="info-protocol" class="font-semibold text-slate-800 dark:text-white">MQTT over WSS (1.0 Hz)</span></div>
            <div class="flex justify-between"><span class="text-slate-500">MAC Address:</span><span class="font-mono text-slate-600 dark:text-slate-400">24:6F:28:B4:7E:9C</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Auth Token / Device ID:</span><span id="info-devid" class="font-mono text-slate-800 dark:text-slate-200">device1</span></div>
          </div>
        </div>

        <div class="blynk-card p-6 space-y-4">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-2">Cloud & Telemetry Status</h3>
          <div class="space-y-3 text-xs">
            <div class="flex justify-between"><span class="text-slate-500">MQTT Broker:</span><span class="font-mono text-slate-800 dark:text-white">broker.emqx.io</span></div>
            <div class="flex justify-between"><span class="text-slate-500">MQTT Port:</span><span class="font-mono text-slate-800 dark:text-white">1883 (TCP) / 8084 (WSS)</span></div>
            <div class="flex justify-between"><span class="text-slate-500">MQTT Topic:</span><span class="font-mono text-[#00c282]">clynk/device1/#</span></div>
            <div class="flex justify-between"><span class="text-slate-500">REST Update Endpoint:</span><span class="font-mono text-slate-600 dark:text-slate-400">/api/blynk/update</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: ESP32 FIRMWARE VIEW -->
    <div id="view-firmware" class="hidden space-y-5">
      <div class="blynk-card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Generated Arduino C++ Sketch</h3>
            <p class="text-xs text-slate-500 mt-0.5">Flash this sketch to your ESP32 to stream all configured datastreams directly to this console</p>
          </div>
          <button onclick="copyFirmwareCode()" class="px-3.5 py-1.5 rounded-lg bg-[#00c282] hover:bg-[#00a36d] text-white text-xs font-bold flex items-center space-x-1.5 transition">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span id="copy-btn-text">Copy Code</span>
          </button>
        </div>

        <pre id="firmware-code-block" class="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto max-h-[420px] custom-scroll leading-relaxed border border-slate-800"></pre>
      </div>
    </div>

  </main>

  <!-- MODAL: DEVICE SETTINGS & MODEL SELECTION -->
  <div id="modal-device-settings" class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm hidden items-center justify-center p-4">
    <div class="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-white/10 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <i data-lucide="settings" class="w-5 h-5 text-[#00c282]"></i>
          <span>Device & Model Settings</span>
        </h3>
        <button onclick="closeDeviceSettingsModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="space-y-3.5 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Device Name</label>
          <input type="text" id="edit-dev-name" value="Iot farming system 001" class="w-full p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans focus:outline-none focus:border-[#00c282]">
        </div>
        <div>
          <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Hardware Model</label>
          <select id="edit-dev-model" class="w-full p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans focus:outline-none focus:border-[#00c282]">
            <option value="ESP32 DevKit V1" selected>ESP32 DevKit V1 (Wi-Fi + BLE)</option>
            <option value="ESP8266 NodeMCU">ESP8266 NodeMCU</option>
            <option value="Raspberry Pi Pico W">Raspberry Pi Pico W</option>
            <option value="Arduino Uno + ESP01">Arduino Uno / Mega</option>
            <option value="STM32 Nucleo">STM32 Nucleo</option>
          </select>
        </div>
        <div>
          <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Location / Tag</label>
          <input type="text" id="edit-dev-location" value="Farm Villa" class="w-full p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans focus:outline-none focus:border-[#00c282]">
        </div>
        <div>
          <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Device ID (MQTT Topic ID)</label>
          <input type="text" id="edit-dev-id" value="device1" class="w-full p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#00c282]">
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-end space-x-2">
        <button onclick="closeDeviceSettingsModal()" class="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs">Cancel</button>
        <button onclick="saveDeviceSettings()" class="px-4 py-2 rounded-lg bg-[#00c282] text-white font-bold text-xs hover:bg-[#00a36d]">Save Changes</button>
      </div>
    </div>
  </div>

  <!-- JAVASCRIPT LOGIC ENGINE -->
  <script>
    // --- Global Application State ---
    const appState = {
      deviceName: localStorage.getItem('clynk_dev_name') || 'Iot farming system 001',
      deviceModel: localStorage.getItem('clynk_dev_model') || 'ESP32 DevKit V1',
      deviceLocation: localStorage.getItem('clynk_dev_location') || 'Farm Villa',
      deviceId: localStorage.getItem('clynk_dev_id') || 'device1',
      streamMode: 'mqtt', // 'mqtt' | 'http' | 'sim'
      timeFilter: 'latest',
      mqttClient: null,
      simInterval: null,
      pollInterval: null,
      packetCount: 0,
      datastreams: JSON.parse(localStorage.getItem('clynk_datastreams') || JSON.stringify([
        { pin: 'V0', name: 'Temperature', type: 'Double', unit: '°C', min: 0, max: 60, color: '#facc15' },
        { pin: 'V1', name: 'Humidity', type: 'Double', unit: '%', min: 0, max: 100, color: '#0284c7' },
        { pin: 'V2', name: 'Alarm Siren', type: 'Integer', unit: 'state', min: 0, max: 1, color: '#ef4444' },
        { pin: 'V3', name: 'Water Pump', type: 'Integer', unit: 'state', min: 0, max: 1, color: '#00c282' },
        { pin: 'V4', name: 'ESP32 Voltage', type: 'Double', unit: 'V', min: 0, max: 5, color: '#10b981' },
        { pin: 'V6', name: 'Soil Moisture', type: 'Double', unit: '%', min: 0, max: 100, color: '#00c282' },
        { pin: 'V7', name: 'Solar Light Lux', type: 'Integer', unit: 'lux', min: 0, max: 1000, color: '#f59e0b' }
      ])),
      pins: {
        V0: 28.3, V1: 89.0, V2: 0, V3: 1, V4: 3.82, V5: 0, V6: 46.0, V7: 340
      }
    };

    const charts = {};

    window.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();
      applyHeaderInfo();
      renderDatastreamsTable();
      initAllCharts();
      updateFirmwareCodeBlock();
      startMQTTStream();

      // Rate ticker
      setInterval(() => {
        const rate = appState.packetCount;
        appState.packetCount = 0;
        const el = document.getElementById('packet-rate-hz');
        if (el) el.innerText = rate.toFixed(1);
      }, 1000);
    });

    // --- Header & Info Sync ---
    function applyHeaderInfo() {
      document.getElementById('device-title').innerText = appState.deviceName;
      document.getElementById('nav-device-title').innerText = appState.deviceName;
      document.getElementById('device-model').innerText = appState.deviceModel;
      document.getElementById('info-model').innerText = appState.deviceModel;
      document.getElementById('device-location').innerText = appState.deviceLocation;
      document.getElementById('info-devid').innerText = appState.deviceId;
    }

    // --- Tab Switcher ---
    function switchTab(tabId) {
      ['dashboard', 'datastreams', 'deviceinfo', 'firmware'].forEach(t => {
        const v = document.getElementById('view-' + t);
        const b = document.getElementById('tab-btn-' + t);
        if (v) v.classList.toggle('hidden', t !== tabId);
        if (b) b.classList.toggle('active', t === tabId);
      });
      lucide.createIcons();
    }

    // --- Stream Mode Switcher ---
    function setStreamMode(mode) {
      appState.streamMode = mode;
      ['mqtt', 'http', 'sim'].forEach(m => {
        const btn = document.getElementById('mode-btn-' + m);
        if (btn) {
          btn.className = (m === mode) 
            ? 'px-2.5 py-1 rounded-md bg-[#00c282] text-white shadow-sm transition font-bold'
            : 'px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition';
        }
      });

      if (appState.simInterval) { clearInterval(appState.simInterval); appState.simInterval = null; }
      if (appState.pollInterval) { clearInterval(appState.pollInterval); appState.pollInterval = null; }

      if (mode === 'mqtt') startMQTTStream();
      if (mode === 'http') startHttpPolling();
      if (mode === 'sim') startSimulatorStream();
    }

    // --- MQTT Stream Engine ---
    function startMQTTStream() {
      if (appState.mqttClient) {
        appState.mqttClient.end(true);
      }
      try {
        const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: 'clynk_console_' + Math.random().toString(16).slice(2, 8) });
        appState.mqttClient = client;

        client.on('connect', () => {
          client.subscribe(`clynk/${appState.deviceId}/#`);
          document.getElementById('status-text').innerText = 'ONLINE (MQTT)';
        });

        client.on('message', (topic, payload) => {
          appState.packetCount++;
          const pin = topic.split('/').pop().toUpperCase();
          const val = parseFloat(payload.toString());
          if (!isNaN(val)) {
            appState.pins[pin] = val;
            updateWidgetUI(pin, val);
          }
        });
      } catch (e) {
        console.error(e);
      }
    }

    // --- HTTP Polling Engine ---
    function startHttpPolling() {
      document.getElementById('status-text').innerText = 'ONLINE (HTTP)';
      appState.pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/pins');
          if (res.ok) {
            const data = await res.json();
            if (data.pins) {
              appState.packetCount++;
              for (const [k, v] of Object.entries(data.pins)) {
                const num = parseFloat(v);
                if (!isNaN(num)) {
                  appState.pins[k] = num;
                  updateWidgetUI(k, num);
                }
              }
            }
          }
        } catch (e) {}
      }, 1000);
    }

    // --- Simulator Engine ---
    function startSimulatorStream() {
      document.getElementById('status-text').innerText = 'SIMULATING';
      let t = 0;
      appState.simInterval = setInterval(() => {
        appState.packetCount++;
        t += 0.1;
        const temp = parseFloat((28.0 + Math.sin(t) * 2.5 + (Math.random() * 0.3)).toFixed(1));
        const hum = Math.floor(88 + Math.cos(t * 0.8) * 5);
        const soil = Math.floor(46 + Math.sin(t * 0.5) * 3);

        appState.pins.V0 = temp;
        appState.pins.V1 = hum;
        appState.pins.V6 = soil;

        updateWidgetUI('V0', temp);
        updateWidgetUI('V1', hum);
        updateWidgetUI('V6', soil);
      }, 1000);
    }

    // --- UI Synchronizer ---
    function updateWidgetUI(pin, val) {
      // 1. Update Gauge text & Arc
      const valEl = document.getElementById('gauge-val-' + pin.toLowerCase());
      if (valEl) valEl.innerText = val;

      const arcEl = document.getElementById('gauge-arc-' + pin.toLowerCase());
      if (arcEl) {
        // circumference is 188.5 for 270 deg arc
        let max = 100;
        if (pin === 'V0') max = 60;
        if (pin === 'V1' || pin === 'V6') max = 100;
        const percent = Math.min(1, Math.max(0, val / max));
        const offset = 188.5 - (percent * 188.5);
        arcEl.style.strokeDashoffset = offset;
      }

      // 2. Update Actuators
      if (pin === 'V3') {
        const active = Number(val) > 0;
        const box = document.getElementById('pump-icon-box');
        const lbl = document.getElementById('pump-status-label');
        const btn = document.getElementById('btn-toggle-v3');
        if (box) box.className = active ? 'w-14 h-14 rounded-2xl bg-emerald-500/10 text-[#00c282] border border-emerald-500/30 flex items-center justify-center' : 'w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-white/10 flex items-center justify-center';
        if (lbl) { lbl.innerText = active ? 'STATUS: RUNNING (1)' : 'STATUS: STOPPED (0)'; lbl.className = active ? 'text-xs font-semibold text-emerald-600 mt-0.5' : 'text-xs font-semibold text-slate-400 mt-0.5'; }
        if (btn) { btn.innerText = active ? 'SWITCH OFF' : 'SWITCH ON'; btn.className = active ? 'px-5 py-2.5 rounded-xl bg-[#00c282] hover:bg-[#00a36d] text-white text-xs font-bold shadow-md transition' : 'px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-bold border border-slate-300 dark:border-white/10 transition'; }
      }

      if (pin === 'V2') {
        const active = Number(val) > 0;
        const box = document.getElementById('alarm-icon-box');
        const lbl = document.getElementById('alarm-status-label');
        const btn = document.getElementById('btn-toggle-v2');
        if (box) box.className = active ? 'w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/30 flex items-center justify-center animate-bounce' : 'w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-white/10 flex items-center justify-center';
        if (lbl) { lbl.innerText = active ? 'STATUS: ALARM ACTIVE (1)' : 'STATUS: IDLE (0)'; lbl.className = active ? 'text-xs font-semibold text-red-500 mt-0.5' : 'text-xs font-semibold text-slate-400 mt-0.5'; }
        if (btn) { btn.innerText = active ? 'SILENCE' : 'ACTIVATE'; btn.className = active ? 'px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-md transition' : 'px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-bold border border-slate-300 dark:border-white/10 transition'; }
      }

      // 3. Update Chart
      const ch = charts[pin];
      if (ch) {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (ch.data.labels.length > 25) {
          ch.data.labels.shift();
          ch.data.datasets[0].data.shift();
        }
        ch.data.labels.push(now);
        ch.data.datasets[0].data.push(val);
        ch.update('none');
      }

      // 4. Update Datastreams Table
      const tableVal = document.getElementById('table-val-' + pin);
      if (tableVal) tableVal.innerText = val;
    }

    // --- Chart Initializer ---
    function initAllCharts() {
      const isDark = document.documentElement.classList.contains('dark');
      const gridColor = isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9';
      const textColor = isDark ? '#94a3b8' : '#64748b';

      const configs = [
        { id: 'V0', color: '#facc15', label: 'TEMPERATURE', min: 0, max: 50, initial: [27.8, 28.0, 28.2, 28.3] },
        { id: 'V1', color: '#0284c7', label: 'HUMIDITY', min: 0, max: 100, initial: [87, 88, 89, 89] },
        { id: 'V6', color: '#00c282', label: 'SOIL MOISTURE', min: 0, max: 100, initial: [45, 45, 46, 46] }
      ];

      configs.forEach(c => {
        const ctx = document.getElementById('chart-' + c.id.toLowerCase());
        if (!ctx) return;
        charts[c.id] = new Chart(ctx.getContext('2d'), {
          type: 'line',
          data: {
            labels: ['08:32 PM', '08:34 PM', '08:36 PM', '08:38 PM'],
            datasets: [{
              label: c.label,
              data: c.initial,
              borderColor: c.color,
              backgroundColor: c.color + '15',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.25,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: { display: false },
              tooltip: { mode: 'index', intersect: false }
            },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } } },
              y: { min: c.min, max: c.max, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } } }
            }
          }
        });
      });
    }

    // --- Actuator Toggle ---
    function toggleActuator(pin) {
      const next = (Number(appState.pins[pin]) || 0) > 0 ? 0 : 1;
      appState.pins[pin] = next;
      updateWidgetUI(pin, next);

      // Send via MQTT
      if (appState.mqttClient && appState.mqttClient.connected) {
        appState.mqttClient.publish(`clynk/${appState.deviceId}/${pin}`, String(next));
      }
      // Send via HTTP
      fetch(`/api/blynk/update?pin=${pin}&value=${next}`).catch(() => {});
    }

    // --- Datastreams Table Renderer ---
    function renderDatastreamsTable() {
      const tbody = document.getElementById('datastreams-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      appState.datastreams.forEach(ds => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition';
        tr.innerHTML = `
          <td class="p-3.5 pl-5 font-bold text-[#00c282]">${ds.pin}</td>
          <td class="p-3.5 font-sans font-semibold text-slate-800 dark:text-slate-200">${ds.name}</td>
          <td class="p-3.5 text-slate-500">${ds.type}</td>
          <td class="p-3.5"><span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">${ds.unit}</span></td>
          <td class="p-3.5 text-slate-500">${ds.min} - ${ds.max}</td>
          <td class="p-3.5 font-bold text-slate-900 dark:text-white" id="table-val-${ds.pin}">${appState.pins[ds.pin] || '0'}</td>
          <td class="p-3.5 text-right pr-5">
            <button onclick="editDatastreamPrompt('${ds.pin}')" class="text-slate-400 hover:text-[#00c282] mr-2">Edit</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // --- Device Settings Modal Handlers ---
    function openDeviceSettingsModal() {
      document.getElementById('edit-dev-name').value = appState.deviceName;
      document.getElementById('edit-dev-model').value = appState.deviceModel;
      document.getElementById('edit-dev-location').value = appState.deviceLocation;
      document.getElementById('edit-dev-id').value = appState.deviceId;
      document.getElementById('modal-device-settings').classList.remove('hidden');
      document.getElementById('modal-device-settings').classList.add('flex');
    }
    function closeDeviceSettingsModal() {
      document.getElementById('modal-device-settings').classList.add('hidden');
      document.getElementById('modal-device-settings').classList.remove('flex');
    }
    function saveDeviceSettings() {
      appState.deviceName = document.getElementById('edit-dev-name').value.trim();
      appState.deviceModel = document.getElementById('edit-dev-model').value;
      appState.deviceLocation = document.getElementById('edit-dev-location').value.trim();
      appState.deviceId = document.getElementById('edit-dev-id').value.trim();

      localStorage.setItem('clynk_dev_name', appState.deviceName);
      localStorage.setItem('clynk_dev_model', appState.deviceModel);
      localStorage.setItem('clynk_dev_location', appState.deviceLocation);
      localStorage.setItem('clynk_dev_id', appState.deviceId);

      applyHeaderInfo();
      updateFirmwareCodeBlock();
      closeDeviceSettingsModal();
      setStreamMode(appState.streamMode);
    }

    function addTagPrompt() {
      const tag = prompt('Enter tag name (e.g. Sector-4, GreenHouse):');
      if (tag) {
        appState.deviceLocation += ` • ${tag}`;
        document.getElementById('device-location').innerText = appState.deviceLocation;
      }
    }

    function editDatastreamPrompt(pin) {
      const ds = appState.datastreams.find(d => d.pin === pin);
      if (!ds) return;
      const newName = prompt(`Enter new name for Datastream ${pin}:`, ds.name);
      if (newName) {
        ds.name = newName;
        localStorage.setItem('clynk_datastreams', JSON.stringify(appState.datastreams));
        renderDatastreamsTable();
      }
    }

    function saveCurrentTemplate() {
      const template = {
        name: appState.deviceName,
        model: appState.deviceModel,
        datastreams: appState.datastreams,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('clynk_template_saved', JSON.stringify(template));
      alert('✅ Template saved successfully! Your layout, device model, and datastreams configuration are stored.');
    }

    // --- Firmware Code Generator ---
    function updateFirmwareCodeBlock() {
      const code = `#include <WiFi.h>
#include <PubSubClient.h>

// --- Configuration ---
const char* ssid        = "YOUR_WIFI_SSID";
const char* password    = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port   = 1883;
const char* device_id   = "${appState.deviceId}"; // ${appState.deviceName}

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT); // Builtin LED / Pump Relay (V3)
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWiFi connected! IP: " + WiFi.localIP().toString());

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("Command [%s]: %s\\n", topic, msg.c_str());

  if (String(topic).endsWith("/V3")) { // Water pump
    digitalWrite(2, msg.toInt() ? HIGH : LOW);
  }
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32-${appState.deviceId}-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("Connected to Blynk.Console MQTT Stream!");
      client.subscribe("clynk/${appState.deviceId}/#");
    } else {
      delay(2000);
    }
  }
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  static unsigned long lastTime = 0;
  if (millis() - lastTime > 1000) { // Stream every 1 second
    lastTime = millis();

    // Read real sensors or use values
    float temp = 28.0 + (random(0, 30) / 10.0); // V0: Temperature
    float hum  = 88.0 + (random(0, 40) / 10.0); // V1: Humidity
    float soil = 45.0 + (random(0, 30) / 10.0); // V6: Soil Moisture

    String base = "clynk/${appState.deviceId}/";
    client.publish((base + "V0").c_str(), String(temp, 1).c_str());
    client.publish((base + "V1").c_str(), String(hum, 1).c_str());
    client.publish((base + "V6").c_str(), String(soil, 1).c_str());

    Serial.printf("Streamed: Temp=%.1f C | Hum=%.1f %% | Soil=%.1f %%\\n", temp, hum, soil);
  }
}`;
      const block = document.getElementById('firmware-code-block');
      if (block) block.innerText = code;
    }

    function copyFirmwareCode() {
      const code = document.getElementById('firmware-code-block').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copy-btn-text');
        btn.innerText = 'Copied! ✓';
        setTimeout(() => btn.innerText = 'Copy Code', 2000);
      });
    }

    function setTimeFilter(filter) {
      appState.timeFilter = filter;
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = document.getElementById('tbtn-' + filter);
      if (activeBtn) activeBtn.classList.add('active');
    }

    function toggleDarkMode() {
      document.documentElement.classList.toggle('dark');
    }

    function exportCSVData() {
      let csv = 'Timestamp,Pin_V0_Temp,Pin_V1_Humidity,Pin_V6_SoilMoisture\\n';
      const now = new Date().toISOString();
      csv += \`"\${now}",\${appState.pins.V0},\${appState.pins.V1},\${appState.pins.V6}\\n\`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = \`blynk_datalog_\${Date.now()}.csv\`;
      a.click();
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

// --- API Route 3: /api/pins (All pins JSON) ---
app.get('/api/pins', (req, res) => {
  const pinsObj = Object.fromEntries(pinStore);
  return res.json({ success: true, pins: pinsObj });
});

// --- API Route 4: Health Check ---
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Root Route: Serve Embedded Authentic Blynk 2.0 Console HTML ---
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(DASHBOARD_HTML);
});

// Local dev server listener
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Blynk.Console Server running on http://localhost:${PORT}`);
  });
}

export default app;
