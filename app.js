/**
 * =====================================================================
 *  Blynk Alter - Frontend Application Engine
 *  Handles Web Serial API, WebSockets, Real-time Charts, Widgets,
 *  Virtual Hardware Simulator, and AI IoT Copilot.
 * =====================================================================
 */

// --- Global Application State ---
const state = {
  activeTab: 'dashboard',
  token: 'demo_token',
  pins: {
    'V0': { value: '24.8', num: 24.8, updated: Date.now() },
    'V1': { value: '58.5', num: 58.5, updated: Date.now() },
    'V2': { value: '0', num: 0, updated: Date.now() },
    'V3': { value: '128', num: 128, updated: Date.now() },
    'V4': { value: '3.82', num: 3.82, updated: Date.now() },
    'V5': { value: '#06B6D4', num: 0, updated: Date.now() },
    'V6': { value: '1013.2', num: 1013.2, updated: Date.now() }
  },
  history: {
    'V0': [],
    'V1': [],
    'V4': []
  },
  widgets: [
    { id: 'w1', type: 'gauge', title: 'Ambient Temperature', pin: 'V0', min: -10, max: 50, unit: '°C', color: '#06B6D4' },
    { id: 'w2', type: 'gauge', title: 'Relative Humidity', pin: 'V1', min: 0, max: 100, unit: '%', color: '#10B981' },
    { id: 'w3', type: 'switch', title: 'Relay 1 (Light / Fan)', pin: 'V2', color: '#10B981' },
    { id: 'w4', type: 'slider', title: 'PWM LED Dimmer', pin: 'V3', min: 0, max: 255, unit: '', color: '#F59E0B' },
    { id: 'w5', type: 'value', title: 'Battery Level (ADC)', pin: 'V4', min: 0, max: 5, unit: 'V', color: '#3B82F6' },
    { id: 'w6', type: 'rgb', title: 'NeoPixel Ambient Color', pin: 'V5', color: '#8B5CF6' },
    { id: 'w7', type: 'chart', title: 'Live Telemetry Multi-Stream', pins: ['V0', 'V1', 'V4'], color: '#06B6D4' },
    { id: 'w8', type: 'lcd', title: '16x2 Character Matrix', pinLine1: 'V0', pinLine2: 'V1', color: '#10B981' }
  ],
  serial: {
    port: null,
    reader: null,
    writer: null,
    connected: false,
    rxBytes: 0,
    txBytes: 0,
    parsedPins: new Set()
  },
  simulator: {
    autoLoop: false,
    intervalId: null,
    tick: 0
  },
  chartInstance: null,
  aiChartInstance: null
};

// --- DOM Element References ---
const dom = {
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  widgetGrid: document.getElementById('widgetGrid'),
  btnSimulateStream: document.getElementById('btnSimulateStream'),
  simBtnLabel: document.getElementById('simBtnLabel'),
  btnAddWidget: document.getElementById('btnAddWidget'),
  btnResetWidgets: document.getElementById('btnResetWidgets'),
  btnExportConfig: document.getElementById('btnExportConfig'),
  
  // Web Serial
  btnConnectSerial: document.getElementById('btnConnectSerial'),
  btnDisconnectSerial: document.getElementById('btnDisconnectSerial'),
  serialBaudSelect: document.getElementById('serialBaudSelect'),
  serialParserMode: document.getElementById('serialParserMode'),
  serialLogContainer: document.getElementById('serialLogContainer'),
  serialInputTx: document.getElementById('serialInputTx'),
  btnSendSerial: document.getElementById('btnSendSerial'),
  btnClearTerminal: document.getElementById('btnClearTerminal'),
  serialStatusBadge: document.getElementById('serialStatusBadge'),
  portStateVal: document.getElementById('portStateVal'),
  portRxBytes: document.getElementById('portRxBytes'),
  portTxBytes: document.getElementById('portTxBytes'),
  portParsedPins: document.getElementById('portParsedPins'),

  // Simulator
  btnBenchAutoLoop: document.getElementById('btnBenchAutoLoop'),
  autoBenchLabel: document.getElementById('autoBenchLabel'),
  simTempSlider: document.getElementById('simTempSlider'),
  simTempDisplay: document.getElementById('simTempDisplay'),
  simHumSlider: document.getElementById('simHumSlider'),
  simHumDisplay: document.getElementById('simHumDisplay'),
  simVoltSlider: document.getElementById('simVoltSlider'),
  simVoltDisplay: document.getElementById('simVoltDisplay'),
  simBtnRelayToggle: document.getElementById('simBtnRelayToggle'),
  simRelayStateBadge: document.getElementById('simRelayStateBadge'),
  simPwmSlider: document.getElementById('simPwmSlider'),
  simPwmDisplay: document.getElementById('simPwmDisplay'),
  simPwmPct: document.getElementById('simPwmPct'),
  simLedGlow: document.getElementById('simLedGlow'),
  simPcbRelayLed: document.getElementById('simPcbRelayLed'),
  simPcbTx: document.getElementById('simPcbTx'),
  simPcbRx: document.getElementById('simPcbRx'),

  // AI Copilot
  aiMessagesContainer: document.getElementById('aiMessagesContainer'),
  aiPromptInput: document.getElementById('aiPromptInput'),
  btnSendAiPrompt: document.getElementById('btnSendAiPrompt'),
  aiChartSurface: document.getElementById('aiChartSurface'),
  aiChartTitle: document.getElementById('aiChartTitle'),
  aiChartDesc: document.getElementById('aiChartDesc'),
  aiInsightText: document.getElementById('aiInsightText'),
  btnCloseAiChart: document.getElementById('btnCloseAiChart'),
  aiDynamicCanvas: document.getElementById('aiDynamicCanvas'),

  // Firmware Studio
  fwBoardSelect: document.getElementById('fwBoardSelect'),
  fwServerUrl: document.getElementById('fwServerUrl'),
  fwAuthToken: document.getElementById('fwAuthToken'),
  fwSsid: document.getElementById('fwSsid'),
  fwPass: document.getElementById('fwPass'),
  btnRegenSketch: document.getElementById('btnRegenSketch'),
  codeBlock: document.getElementById('codeBlock'),
  btnCopyCode: document.getElementById('btnCopyCode'),
  btnDownloadIno: document.getElementById('btnDownloadIno'),
  fwFileNameLabel: document.getElementById('fwFileNameLabel'),

  // Modal
  widgetModal: document.getElementById('widgetModal'),
  modalTitle: document.getElementById('modalTitle'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnCancelWidget: document.getElementById('btnCancelWidget'),
  btnSaveWidget: document.getElementById('btnSaveWidget'),
  wTypeSelect: document.getElementById('wTypeSelect'),
  wSizeSelect: document.getElementById('wSizeSelect'),
  wTitleInput: document.getElementById('wTitleInput'),
  wPinSelect: document.getElementById('wPinSelect'),
  wMinInput: document.getElementById('wMinInput'),
  wMaxInput: document.getElementById('wMaxInput'),
  wUnitInput: document.getElementById('wUnitInput'),
  wAlarmInput: document.getElementById('wAlarmInput'),
  wColorSelect: document.getElementById('wColorSelect'),

  // Notifications
  cfgTelegramToken: document.getElementById('cfgTelegramToken'),
  cfgTelegramChatId: document.getElementById('cfgTelegramChatId'),
  btnTestTelegram: document.getElementById('btnTestTelegram'),
  stTelegram: document.getElementById('stTelegram'),
  cfgDiscordWebhook: document.getElementById('cfgDiscordWebhook'),
  btnTestDiscord: document.getElementById('btnTestDiscord'),
  stDiscord: document.getElementById('stDiscord'),
  cfgNtfyTopic: document.getElementById('cfgNtfyTopic'),
  btnTestNtfy: document.getElementById('btnTestNtfy'),
  stNtfy: document.getElementById('stNtfy'),
  btnEnableBrowserNotif: document.getElementById('btnEnableBrowserNotif'),
  stBrowserNotif: document.getElementById('stBrowserNotif'),
  btnTestAllAlerts: document.getElementById('btnTestAllAlerts'),

  // Prompt Library
  promptChipsGrid: document.getElementById('promptChipsGrid')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initNavTabs();
  initSampleHistory();
  renderWidgets();
  initSimulatorControls();
  initWebSerial();
  initAICopilot();
  initPromptLibrary();
  initNotificationHub();
  initFirmwareGenerator();
  initApiTester();
  connectEventStream();

  // Check if Web Serial API is supported
  if (!('serial' in navigator)) {
    dom.serialStatusBadge.textContent = 'USB Emulated';
    dom.serialStatusBadge.classList.add('badge-purple');
    appendSerialLog('sys', '[SYSTEM] Web Serial API not supported in this browser. Serial commands will be emulated locally.');
  }
});

// --- Tab Switching ---
function initNavTabs() {
  dom.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      dom.navTabs.forEach(t => t.classList.remove('active'));
      dom.tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const activeContent = document.getElementById(`view-${target}`);
      if (activeContent) activeContent.classList.add('active');
      state.activeTab = target;

      if (target === 'dashboard' && state.chartInstance) {
        state.chartInstance.resize();
      }
      if (target === 'firmware') {
        generateSketch();
      }
    });
  });
}

// --- Preload Sample History for Smooth Initial Charts ---
function initSampleHistory() {
  const now = Date.now();
  for (let i = 20; i >= 0; i--) {
    const t = now - i * 3000;
    const temp = 24.5 + Math.sin(i / 3) * 1.5;
    const hum = 58.0 + Math.cos(i / 2) * 4.0;
    const volt = 3.82 + (Math.random() * 0.04 - 0.02);
    
    state.history['V0'].push({ time: t, val: +temp.toFixed(1) });
    state.history['V1'].push({ time: t, val: +hum.toFixed(1) });
    state.history['V4'].push({ time: t, val: +volt.toFixed(2) });
  }
}

// --- Core Pin Update Engine ---
function updatePin(pin, rawValue, source = 'local') {
  const p = pin.toUpperCase();
  const valStr = String(rawValue);
  const numVal = parseFloat(valStr);

  state.pins[p] = {
    value: valStr,
    num: isNaN(numVal) ? 0 : numVal,
    updated: Date.now()
  };

  // Keep telemetry history
  if (!state.history[p]) state.history[p] = [];
  state.history[p].push({ time: Date.now(), val: isNaN(numVal) ? 0 : numVal });
  if (state.history[p].length > 100) state.history[p].shift();

  // Update UI widgets
  updateWidgetUI(p);

  // Update Simulator UI to stay in sync
  syncSimulatorUI(p, valStr, numVal);

  // If source is local UI / simulator, sync to backend server or Web Serial
  if (source === 'local' || source === 'sim') {
    syncToBackend(p, valStr);
    if (state.serial.connected && state.serial.writer) {
      sendSerialCommand(`${p}=${valStr}\n`);
    }
  }

  // Update Web Serial parsed pins tally
  state.serial.parsedPins.add(p);
  dom.portParsedPins.textContent = Array.from(state.serial.parsedPins).join(', ');

  // Check Alarm Thresholds & dispatch alerts if exceeded
  checkAlarmThresholds(p, isNaN(numVal) ? 0 : numVal);
}

// --- Sync Pin to Cloud / Local REST API ---
async function syncToBackend(pin, value) {
  try {
    fetch(`/api/blynk/update?token=${state.token}&pin=${pin}&value=${encodeURIComponent(value)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {
      // Offline fallback silently ignored
    });
  } catch (e) {
    // Silent
  }
}

// --- Server-Sent Events / Real-time Live Connection ---
function connectEventStream() {
  if (typeof EventSource !== 'undefined') {
    try {
      const evtSource = new EventSource('/api/blynk/events');
      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pin_update' && data.pin && data.value !== undefined) {
            updatePin(data.pin, data.value, 'server_sse');
            flashRxLed();
          }
        } catch (e) {}
      };
      evtSource.onerror = () => {
        // Fallback to local polling if SSE fails
        evtSource.close();
      };
    } catch (err) {}
  }
}

// --- Default Widget Definitions ---
const DEFAULT_WIDGETS = [
  { id: 'w1', type: 'gauge', title: 'Ambient Temperature', pin: 'V0', min: -10, max: 50, unit: '°C', color: '#06B6D4', size: 1, alarmHigh: 35 },
  { id: 'w2', type: 'gauge', title: 'Relative Humidity', pin: 'V1', min: 0, max: 100, unit: '%', color: '#10B981', size: 1, alarmHigh: 85 },
  { id: 'w3', type: 'switch', title: 'Relay 1 (Light / Fan)', pin: 'V2', color: '#10B981', size: 1 },
  { id: 'w4', type: 'slider', title: 'PWM LED Dimmer', pin: 'V3', min: 0, max: 255, unit: '', color: '#F59E0B', size: 1 },
  { id: 'w5', type: 'value', title: 'Battery Level (ADC)', pin: 'V4', min: 0, max: 5, unit: 'V', color: '#3B82F6', size: 1, alarmHigh: null },
  { id: 'w6', type: 'rgb', title: 'NeoPixel Ambient Color', pin: 'V5', color: '#8B5CF6', size: 1 },
  { id: 'w7', type: 'chart', title: 'Live Telemetry Multi-Stream', pins: ['V0', 'V1', 'V4'], color: '#06B6D4', size: 2 },
  { id: 'w8', type: 'lcd', title: '16x2 Character Matrix', pinLine1: 'V0', pinLine2: 'V1', color: '#10B981', size: 1 }
];

// Load saved widgets from localStorage if available
try {
  const saved = localStorage.getItem('blynk_alter_widgets');
  if (saved) state.widgets = JSON.parse(saved);
  else state.widgets = DEFAULT_WIDGETS;
} catch (e) {
  state.widgets = DEFAULT_WIDGETS;
}

let editingWidgetId = null;

// --- Notification Settings State ---
const notifConfig = {
  telegramToken: localStorage.getItem('cfg_tg_token') || '',
  telegramChatId: localStorage.getItem('cfg_tg_chat') || '',
  discordWebhook: localStorage.getItem('cfg_discord_url') || '',
  ntfyTopic: localStorage.getItem('cfg_ntfy_topic') || 'my_esp32_alerts_test',
  browserEnabled: false,
  lastAlertTimes: {}
};

// --- Widget Grid Renderer ---
function renderWidgets() {
  saveWidgetsToStorage();
  dom.widgetGrid.innerHTML = '';

  state.widgets.forEach(w => {
    const card = document.createElement('div');
    const sizeCls = `size-${w.size || 1}`;
    card.className = `card widget-card ${sizeCls} ${w.type === 'chart' ? 'chart-widget-card' : ''}`;
    card.id = `widget-${w.id}`;

    const pinValue = state.pins[w.pin]?.value ?? '0';
    const numValue = state.pins[w.pin]?.num ?? 0;

    let bodyHtml = '';

    if (w.type === 'gauge') {
      const pct = Math.min(100, Math.max(0, ((numValue - w.min) / (w.max - w.min)) * 100));
      const strokeOffset = 283 - (283 * pct) / 100;
      bodyHtml = `
        <div class="gauge-widget-container">
          <svg class="gauge-svg" viewBox="0 0 200 120">
            <path class="gauge-bg-arc" d="M 20 100 A 80 80 0 0 1 180 100" />
            <path class="gauge-fill-arc" id="gauge-fill-${w.id}" d="M 20 100 A 80 80 0 0 1 180 100" 
                  style="stroke-dashoffset: ${strokeOffset}; stroke: ${w.color};" />
          </svg>
          <div class="gauge-readout">
            <span class="gauge-number" id="gauge-num-${w.id}">${numValue.toFixed(1)}</span>
            <span class="gauge-unit">${w.unit}</span>
          </div>
          <div class="gauge-minmax">
            <span>${w.min}${w.unit}</span>
            <span>${w.alarmHigh ? '⚠️ ' + w.alarmHigh + w.unit : ''}</span>
            <span>${w.max}${w.unit}</span>
          </div>
        </div>
      `;
    } 
    else if (w.type === 'switch') {
      const isOn = pinValue === '1' || pinValue === 'HIGH' || pinValue === 'true';
      bodyHtml = `
        <div class="switch-widget-container">
          <div class="relay-status-pill ${isOn ? 'on' : ''}" id="switch-pill-${w.id}">
            ${isOn ? 'CONTACT CLOSED (ON)' : 'CONTACT OPEN (OFF)'}
          </div>
          <label class="toggle-switch-large">
            <input type="checkbox" id="switch-input-${w.id}" ${isOn ? 'checked' : ''} onchange="handleSwitchToggle('${w.id}', '${w.pin}', this.checked)">
            <span class="toggle-slider-large"></span>
          </label>
        </div>
      `;
    }
    else if (w.type === 'slider') {
      bodyHtml = `
        <div class="slider-widget-container">
          <div class="slider-val-readout">
            <span class="main-val" id="slider-val-${w.id}">${numValue}</span>
            <span class="gauge-unit">${Math.round((numValue / (w.max || 255)) * 100)}%</span>
          </div>
          <input type="range" class="range-slider" id="slider-input-${w.id}" min="${w.min}" max="${w.max}" value="${numValue}"
                 oninput="handleSliderChange('${w.id}', '${w.pin}', this.value)" style="accent-color: ${w.color};">
        </div>
      `;
    }
    else if (w.type === 'value') {
      bodyHtml = `
        <div class="slider-widget-container">
          <div class="slider-val-readout" style="padding: 1rem 0;">
            <span class="main-val" id="val-display-${w.id}" style="color: ${w.color}; font-size: 2.4rem;">${pinValue}</span>
            <span class="gauge-unit" style="font-size: 1.2rem;">${w.unit}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-dim); font-family: var(--font-mono);">
            Updated: <span id="val-time-${w.id}">Just now</span>
          </div>
        </div>
      `;
    }
    else if (w.type === 'rgb') {
      bodyHtml = `
        <div class="rgb-widget-container">
          <div class="rgb-color-preview" id="rgb-preview-${w.id}" style="background-color: ${pinValue}; box-shadow: 0 0 20px ${pinValue};"></div>
          <div class="rgb-input-group">
            <label style="font-size: 0.8rem; color: var(--text-muted);">NeoPixel Lamp Color</label>
            <input type="color" id="rgb-input-${w.id}" value="${pinValue}" onchange="handleRgbChange('${w.id}', '${w.pin}', this.value)" style="cursor: pointer; width: 100px; height: 36px; border: none; border-radius: 6px;">
          </div>
        </div>
      `;
    }
    else if (w.type === 'lcd') {
      const line1Val = state.pins[w.pinLine1]?.value ?? '24.8 C';
      const line2Val = state.pins[w.pinLine2]?.value ?? '58.5 %';
      bodyHtml = `
        <div class="lcd-container">
          <div class="lcd-line" id="lcd-line1-${w.id}">TEMP: ${line1Val} C</div>
          <div class="lcd-line" id="lcd-line2-${w.id}">HUM:  ${line2Val} %</div>
        </div>
      `;
    }
    else if (w.type === 'chart') {
      bodyHtml = `
        <div class="chart-canvas-wrapper">
          <canvas id="liveChartCanvas"></canvas>
        </div>
      `;
    }

    const currentSizeLabel = (w.size === 3) ? '3x' : ((w.size === 2) ? '2x' : '1x');

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <span>${w.title}</span>
          <span class="pin-tag">${w.pin || (w.pins ? w.pins.join('+') : 'V0')}</span>
        </div>
        <div class="card-actions">
          <button class="widget-ctrl-btn" onclick="cycleWidgetSize('${w.id}')" title="Resize Widget (${currentSizeLabel})">
            <span>⇱ ${currentSizeLabel}</span>
          </button>
          <button class="widget-ctrl-btn" onclick="openEditWidget('${w.id}')" title="Edit Widget Properties">
            <span>✎</span>
          </button>
          <button class="btn btn-xs btn-outline" onclick="deleteWidget('${w.id}')" title="Delete Widget">&times;</button>
        </div>
      </div>
      <div class="card-body">
        ${bodyHtml}
      </div>
    `;

    dom.widgetGrid.appendChild(card);
  });

  // Re-attach Chart.js on liveChartCanvas
  initLiveChart();
}

function saveWidgetsToStorage() {
  try {
    localStorage.setItem('blynk_alter_widgets', JSON.stringify(state.widgets));
  } catch (e) {}
}

// Cycle size 1 -> 2 -> 3 -> 1
window.cycleWidgetSize = function(widgetId) {
  const w = state.widgets.find(item => item.id === widgetId);
  if (!w) return;
  const current = w.size || 1;
  w.size = (current >= 3) ? 1 : current + 1;
  renderWidgets();
};

// Open Property Inspector Modal
window.openEditWidget = function(widgetId) {
  const w = state.widgets.find(item => item.id === widgetId);
  if (!w) return;

  editingWidgetId = widgetId;
  dom.modalTitle.textContent = 'Edit Dashboard Widget';
  dom.wTypeSelect.value = w.type;
  dom.wSizeSelect.value = String(w.size || 1);
  dom.wTitleInput.value = w.title;
  dom.wPinSelect.value = w.pin || 'V0';
  dom.wMinInput.value = w.min !== undefined ? w.min : 0;
  dom.wMaxInput.value = w.max !== undefined ? w.max : 100;
  dom.wUnitInput.value = w.unit || '';
  dom.wAlarmInput.value = w.alarmHigh !== undefined && w.alarmHigh !== null ? w.alarmHigh : '';
  dom.wColorSelect.value = w.color || '#06B6D4';

  dom.widgetModal.classList.remove('hidden');
};

// --- Live Chart.js Setup ---
function initLiveChart() {
  const ctx = document.getElementById('liveChartCanvas');
  if (!ctx) return;

  const v0Data = state.history['V0'] || [];
  const labels = v0Data.map(d => new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Temperature V0 (°C)',
          data: (state.history['V0'] || []).map(d => d.val),
          borderColor: '#06B6D4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Humidity V1 (%)',
          data: (state.history['V1'] || []).map(d => d.val),
          borderColor: '#10B981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: { color: '#9CA3AF', font: { family: 'Plus Jakarta Sans', size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#6B7280', maxTicksLimit: 6, font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#6B7280', font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

// --- Update Specific Widget UI Elements ---
function updateWidgetUI(pin) {
  const pinData = state.pins[pin];
  if (!pinData) return;

  state.widgets.forEach(w => {
    if (w.pin === pin) {
      if (w.type === 'gauge') {
        const fill = document.getElementById(`gauge-fill-${w.id}`);
        const num = document.getElementById(`gauge-num-${w.id}`);
        if (fill && num) {
          const pct = Math.min(100, Math.max(0, ((pinData.num - w.min) / (w.max - w.min)) * 100));
          fill.style.strokeDashoffset = 283 - (283 * pct) / 100;
          num.textContent = pinData.num.toFixed(1);
        }
      }
      else if (w.type === 'switch') {
        const pill = document.getElementById(`switch-pill-${w.id}`);
        const input = document.getElementById(`switch-input-${w.id}`);
        const isOn = pinData.value === '1' || pinData.value === 'HIGH' || pinData.value === 'true';
        if (pill) {
          pill.className = `relay-status-pill ${isOn ? 'on' : ''}`;
          pill.textContent = isOn ? 'CONTACT CLOSED (ON)' : 'CONTACT OPEN (OFF)';
        }
        if (input) input.checked = isOn;
      }
      else if (w.type === 'slider') {
        const val = document.getElementById(`slider-val-${w.id}`);
        const input = document.getElementById(`slider-input-${w.id}`);
        if (val) val.textContent = pinData.num;
        if (input && document.activeElement !== input) input.value = pinData.num;
      }
      else if (w.type === 'value') {
        const disp = document.getElementById(`val-display-${w.id}`);
        const time = document.getElementById(`val-time-${w.id}`);
        if (disp) disp.textContent = pinData.value;
        if (time) time.textContent = new Date(pinData.updated).toLocaleTimeString();
      }
      else if (w.type === 'rgb') {
        const preview = document.getElementById(`rgb-preview-${w.id}`);
        const input = document.getElementById(`rgb-input-${w.id}`);
        if (preview) {
          preview.style.backgroundColor = pinData.value;
          preview.style.boxShadow = `0 0 20px ${pinData.value}`;
        }
        if (input && document.activeElement !== input) input.value = pinData.value;
      }
    }

    // LCD character matrix updates
    if (w.type === 'lcd') {
      const line1 = document.getElementById(`lcd-line1-${w.id}`);
      const line2 = document.getElementById(`lcd-line2-${w.id}`);
      if (line1) line1.textContent = `TEMP: ${state.pins['V0']?.value || '24.8'} C`;
      if (line2) line2.textContent = `HUM:  ${state.pins['V1']?.value || '58.5'} %`;
    }
  });

  // Push to Live Chart
  if (state.chartInstance && (pin === 'V0' || pin === 'V1')) {
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const chart = state.chartInstance;
    
    chart.data.labels.push(timeLabel);
    if (chart.data.labels.length > 25) chart.data.labels.shift();

    if (chart.data.datasets[0]) {
      chart.data.datasets[0].data.push(state.pins['V0']?.num || 0);
      if (chart.data.datasets[0].data.length > 25) chart.data.datasets[0].data.shift();
    }
    if (chart.data.datasets[1]) {
      chart.data.datasets[1].data.push(state.pins['V1']?.num || 0);
      if (chart.data.datasets[1].data.length > 25) chart.data.datasets[1].data.shift();
    }

    chart.update('none');
  }
}

// --- Widget User Actions ---
window.handleSwitchToggle = function(widgetId, pin, isChecked) {
  const val = isChecked ? '1' : '0';
  updatePin(pin, val, 'local');
  flashTxLed();
};

window.handleSliderChange = function(widgetId, pin, value) {
  updatePin(pin, value, 'local');
  flashTxLed();
};

window.handleRgbChange = function(widgetId, pin, hexColor) {
  updatePin(pin, hexColor, 'local');
  flashTxLed();
};

window.deleteWidget = function(widgetId) {
  state.widgets = state.widgets.filter(w => w.id !== widgetId);
  renderWidgets();
};

// --- Virtual Hardware Simulator Controls ---
function initSimulatorControls() {
  // DHT22 Temp Slider
  dom.simTempSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    dom.simTempDisplay.textContent = val;
    updatePin('V0', val, 'sim');
    flashTxLed();
  });

  // DHT22 Hum Slider
  dom.simHumSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    dom.simHumDisplay.textContent = val;
    updatePin('V1', val, 'sim');
    flashTxLed();
  });

  // Potentiometer Voltage Slider
  dom.simVoltSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    dom.simVoltDisplay.textContent = val;
    updatePin('V4', val, 'sim');
    flashTxLed();
  });

  // PWM LED Slider
  dom.simPwmSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    dom.simPwmDisplay.textContent = val;
    dom.simPwmPct.textContent = Math.round((val / 255) * 100);
    dom.simLedGlow.style.backgroundColor = `rgba(245, 158, 11, ${val / 255})`;
    dom.simLedGlow.style.boxShadow = `0 0 ${val / 10}px rgba(245, 158, 11, ${val / 255})`;
    updatePin('V3', String(val), 'sim');
    flashTxLed();
  });

  // Relay Toggle Button
  dom.simBtnRelayToggle.addEventListener('click', () => {
    const current = state.pins['V2']?.value === '1';
    const nextVal = current ? '0' : '1';
    updatePin('V2', nextVal, 'sim');
    flashTxLed();
  });

  // Auto-Bench Waveform Engine
  dom.btnBenchAutoLoop.addEventListener('click', toggleAutoSimulator);
  dom.btnSimulateStream.addEventListener('click', toggleAutoSimulator);
}

function syncSimulatorUI(pin, valStr, numVal) {
  if (pin === 'V0') {
    dom.simTempSlider.value = numVal;
    dom.simTempDisplay.textContent = numVal.toFixed(1);
  }
  else if (pin === 'V1') {
    dom.simHumSlider.value = numVal;
    dom.simHumDisplay.textContent = numVal.toFixed(0);
  }
  else if (pin === 'V2') {
    const isOn = valStr === '1';
    dom.simRelayStateBadge.textContent = isOn ? 'ON (NO Contact Energized)' : 'OFF (NC Contact)';
    dom.simRelayStateBadge.className = `relay-status-display ${isOn ? 'active' : ''}`;
    if (dom.simPcbRelayLed) {
      dom.simPcbRelayLed.className = `led-dot led-amber ${isOn ? 'active' : ''}`;
    }
  }
  else if (pin === 'V3') {
    dom.simPwmSlider.value = numVal;
    dom.simPwmDisplay.textContent = numVal;
    dom.simPwmPct.textContent = Math.round((numVal / 255) * 100);
    dom.simLedGlow.style.backgroundColor = `rgba(245, 158, 11, ${numVal / 255})`;
    dom.simLedGlow.style.boxShadow = `0 0 ${numVal / 10}px rgba(245, 158, 11, ${numVal / 255})`;
  }
  else if (pin === 'V4') {
    dom.simVoltSlider.value = numVal;
    dom.simVoltDisplay.textContent = numVal.toFixed(2);
  }
}

function toggleAutoSimulator() {
  state.simulator.autoLoop = !state.simulator.autoLoop;

  if (state.simulator.autoLoop) {
    dom.autoBenchLabel.textContent = 'Stop Auto-Sensor Waves';
    dom.simBtnLabel.textContent = 'Stop Live Stream';
    dom.btnSimulateStream.classList.replace('btn-secondary', 'btn-danger');

    state.simulator.intervalId = setInterval(() => {
      state.simulator.tick++;
      const t = state.simulator.tick;
      
      const newTemp = +(24.0 + Math.sin(t / 4) * 3.5 + (Math.random() * 0.3 - 0.15)).toFixed(1);
      const newHum = +(55.0 + Math.cos(t / 3) * 8.0 + (Math.random() * 0.5 - 0.25)).toFixed(1);
      const newVolt = +(3.85 - (t % 50) * 0.005 + (Math.random() * 0.02 - 0.01)).toFixed(2);

      updatePin('V0', newTemp, 'sim');
      updatePin('V1', newHum, 'sim');
      updatePin('V4', newVolt, 'sim');

      flashRxLed();
    }, 1200);
  } else {
    dom.autoBenchLabel.textContent = 'Start Auto-Sensor Waves';
    dom.simBtnLabel.textContent = 'Live Test Stream';
    dom.btnSimulateStream.classList.replace('btn-danger', 'btn-secondary');
    clearInterval(state.simulator.intervalId);
  }
}

// --- Web Serial API (Direct USB Port Reader) ---
function initWebSerial() {
  dom.btnConnectSerial.addEventListener('click', async () => {
    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    try {
      const baudRate = parseInt(dom.serialBaudSelect.value, 10);
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });

      state.serial.port = port;
      state.serial.connected = true;

      dom.btnConnectSerial.classList.add('hidden');
      dom.btnDisconnectSerial.classList.remove('hidden');
      dom.serialStatusBadge.textContent = 'Connected (USB)';
      dom.serialStatusBadge.classList.replace('badge-purple', 'badge-green');
      dom.portStateVal.textContent = `Connected @ ${baudRate} baud`;

      appendSerialLog('sys', `[USB] Connected to serial port at ${baudRate} baud!`);

      // Start Read Loop
      readSerialLoop(port);

      // Setup Writer
      const encoder = new TextEncoderStream();
      encoder.readable.pipeTo(port.writable);
      state.serial.writer = encoder.writable.getWriter();

    } catch (err) {
      appendSerialLog('err', `[USB ERROR] ${err.message}`);
    }
  });

  dom.btnDisconnectSerial.addEventListener('click', async () => {
    if (state.serial.port) {
      try {
        if (state.serial.reader) await state.serial.reader.cancel();
        if (state.serial.writer) await state.serial.writer.close();
        await state.serial.port.close();
      } catch (e) {}
      state.serial.connected = false;
      dom.btnConnectSerial.classList.remove('hidden');
      dom.btnDisconnectSerial.classList.add('hidden');
      dom.serialStatusBadge.textContent = 'Ready';
      dom.portStateVal.textContent = 'Disconnected';
      appendSerialLog('sys', '[USB] Port disconnected.');
    }
  });

  dom.btnSendSerial.addEventListener('click', () => {
    const cmd = dom.serialInputTx.value.trim();
    if (!cmd) return;
    sendSerialCommand(cmd + '\n');
    dom.serialInputTx.value = '';
  });

  dom.serialInputTx.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') dom.btnSendSerial.click();
  });

  dom.btnClearTerminal.addEventListener('click', () => {
    dom.serialLogContainer.innerHTML = '';
  });

  // Quick Command Chips
  document.querySelectorAll('.cmd-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-cmd');
      sendSerialCommand(cmd + '\n');
    });
  });
}

async function readSerialLoop(port) {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();
  state.serial.reader = reader;

  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        state.serial.rxBytes += value.length;
        dom.portRxBytes.textContent = formatBytes(state.serial.rxBytes);
        buffer += value;

        // Process line by line
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete chunk

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine) {
            appendSerialLog('rx', cleanLine);
            parseIncomingSerialLine(cleanLine);
            flashRxLed();
          }
        }
      }
    }
  } catch (err) {
    appendSerialLog('err', `[RX STREAM ERROR] ${err.message}`);
  }
}

async function sendSerialCommand(text) {
  appendSerialLog('tx', `> ${text.trim()}`);
  state.serial.txBytes += text.length;
  dom.portTxBytes.textContent = formatBytes(state.serial.txBytes);
  flashTxLed();

  if (state.serial.writer) {
    try {
      await state.serial.writer.write(text);
    } catch (e) {
      appendSerialLog('err', `[TX FAILED] ${e.message}`);
    }
  } else {
    // Emulated response if no physical USB port attached
    handleEmulatedSerialTx(text.trim());
  }
}

function parseIncomingSerialLine(line) {
  const mode = dom.serialParserMode.value;

  // Blynk Alter standard format: "V0:24.5" or "V2:1"
  if (line.match(/^([VDA]\d+|GPIO\d+):(.+)$/i)) {
    const parts = line.split(':');
    const pin = parts[0].toUpperCase();
    const val = parts[1].trim();
    updatePin(pin, val, 'serial');
  }
  // JSON Mode: {"V0": 24.5}
  else if (mode === 'json' && line.startsWith('{')) {
    try {
      const obj = JSON.parse(line);
      for (const [k, v] of Object.entries(obj)) {
        updatePin(k, v, 'serial');
      }
    } catch (e) {}
  }
  // CSV Mode: 24.5, 58.2, 3.8
  else if (mode === 'csv' && line.includes(',')) {
    const vals = line.split(',');
    if (vals[0]) updatePin('V0', vals[0].trim(), 'serial');
    if (vals[1]) updatePin('V1', vals[1].trim(), 'serial');
    if (vals[2]) updatePin('V4', vals[2].trim(), 'serial');
  }
}

function handleEmulatedSerialTx(cmd) {
  if (cmd.startsWith('V2=')) {
    const val = cmd.substring(3);
    setTimeout(() => {
      appendSerialLog('rx', `ACK:V2=${val}`);
      updatePin('V2', val, 'serial');
    }, 100);
  } else if (cmd.startsWith('V3=')) {
    const val = cmd.substring(3);
    setTimeout(() => {
      appendSerialLog('rx', `ACK:V3=${val}`);
      updatePin('V3', val, 'serial');
    }, 100);
  } else if (cmd === 'PING') {
    setTimeout(() => appendSerialLog('rx', 'PONG (Arduino Uno ready)'), 80);
  }
}

function appendSerialLog(type, text) {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.textContent = `[${time}] ${text}`;
  dom.serialLogContainer.appendChild(line);

  if (document.getElementById('serialAutoScroll').checked) {
    dom.serialLogContainer.scrollTop = dom.serialLogContainer.scrollHeight;
  }
}

// --- AI IoT Copilot ---
function initAICopilot() {
  dom.btnSendAiPrompt.addEventListener('click', sendAIPrompt);
  dom.aiPromptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendAIPrompt();
  });

  document.querySelectorAll('.prompt-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      dom.aiPromptInput.value = chip.getAttribute('data-prompt');
      sendAIPrompt();
    });
  });

  dom.btnCloseAiChart.addEventListener('click', () => {
    dom.aiChartSurface.classList.add('hidden');
  });
}

async function sendAIPrompt() {
  const prompt = dom.aiPromptInput.value.trim();
  if (!prompt) return;

  // Render user message
  appendAiMessage('user', prompt);
  dom.aiPromptInput.value = '';

  // Render typing bubble
  const botMsgElem = appendAiMessage('bot', 'Analyzing telemetry and reasoning...');

  try {
    const res = await fetch('/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, token: state.token })
    });

    const data = await res.json();
    botMsgElem.innerHTML = `<p>${data.insights || 'Telemetry analyzed.'}</p>`;

    // If actions were executed
    if (data.actions && data.actions.length > 0) {
      for (const act of data.actions) {
        updatePin(act.pin, act.value, 'ai');
      }
    }

    // Render Dynamic AI Chart if data provided
    if (data.data && data.data.length > 0 && data.chartType !== 'kpi_card') {
      renderAIDynamicChart(data);
    }

  } catch (err) {
    // Offline AI fallback
    const fallbackResponse = processOfflineAiPrompt(prompt);
    botMsgElem.innerHTML = `<p>${fallbackResponse.insights}</p>`;
    if (fallbackResponse.data) {
      renderAIDynamicChart(fallbackResponse);
    }
  }
}

function appendAiMessage(role, text) {
  const row = document.createElement('div');
  row.className = `ai-msg ${role}`;
  row.innerHTML = `
    <div class="avatar">${role === 'user' ? 'YOU' : 'AI'}</div>
    <div class="msg-bubble">${text}</div>
  `;
  dom.aiMessagesContainer.appendChild(row);
  dom.aiMessagesContainer.scrollTop = dom.aiMessagesContainer.scrollHeight;
  return row.querySelector('.msg-bubble');
}

function renderAIDynamicChart(aiObj) {
  dom.aiChartSurface.classList.remove('hidden');
  dom.aiChartTitle.textContent = aiObj.title || 'Telemetry Analysis';
  dom.aiChartDesc.textContent = aiObj.description || '';
  dom.aiInsightText.textContent = aiObj.insights || '';

  const ctx = dom.aiDynamicCanvas;
  if (!ctx) return;

  if (state.aiChartInstance) {
    state.aiChartInstance.destroy();
  }

  const series = aiObj.seriesKeys || ['temperature', 'humidity'];
  const labels = aiObj.data.map(d => d.time || d.timestamp || 'T');

  const datasets = series.map((k, idx) => {
    const colors = ['#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];
    const c = colors[idx % colors.length];
    return {
      label: k.toUpperCase(),
      data: aiObj.data.map(d => d[k]),
      borderColor: c,
      backgroundColor: c + '22',
      borderWidth: 2,
      tension: 0.3,
      fill: idx === 0
    };
  });

  state.aiChartInstance = new Chart(ctx, {
    type: aiObj.chartType === 'bar' ? 'bar' : 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9CA3AF', font: { family: 'Plus Jakarta Sans', size: 11 } } }
      },
      scales: {
        x: { ticks: { color: '#6B7280' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#6B7280' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function processOfflineAiPrompt(prompt) {
  const q = prompt.toLowerCase();
  if (q.includes('relay') || q.includes('light') || q.includes('turn on')) {
    updatePin('V2', '1', 'ai');
    return {
      insights: 'Switched Relay (V2) to ON/HIGH state.',
      chartType: 'kpi_card'
    };
  }
  if (q.includes('battery') || q.includes('volt')) {
    const chartData = [];
    for (let i = 10; i >= 0; i--) {
      chartData.push({ time: `${10-i}m ago`, voltage: +(3.82 - i * 0.01).toFixed(2) });
    }
    return {
      title: 'Battery Discharge Curve',
      description: 'Battery health nominal at 3.82V',
      chartType: 'line',
      seriesKeys: ['voltage'],
      data: chartData,
      insights: 'Battery telemetry indicates optimal discharge rate with no voltage brownout risks.'
    };
  }
  const chartData = [];
  for (let i = 10; i >= 0; i--) {
    chartData.push({ time: `${(10-i)*5}m ago`, temperature: +(24.5 + Math.sin(i/2)*2).toFixed(1), humidity: +(58 + Math.cos(i/2)*4).toFixed(1) });
  }
  return {
    title: 'Temperature & Humidity Overview',
    description: 'Dynamic offline telemetry reconstruction',
    chartType: 'line',
    seriesKeys: ['temperature', 'humidity'],
    data: chartData,
    insights: 'Environmental metrics are stable within comfortable indoor living boundaries.'
  };
}

// --- C++ Firmware Studio Generator ---
function initFirmwareGenerator() {
  dom.btnRegenSketch.addEventListener('click', generateSketch);
  dom.fwBoardSelect.addEventListener('change', generateSketch);

  dom.btnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(dom.codeBlock.textContent);
    dom.btnCopyCode.textContent = 'Copied! ✓';
    setTimeout(() => dom.btnCopyCode.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy Sketch`, 2000);
  });

  dom.btnDownloadIno.addEventListener('click', () => {
    const code = dom.codeBlock.textContent;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dom.fwFileNameLabel.textContent || 'sketch.ino';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function generateSketch() {
  const board = dom.fwBoardSelect.value;
  const token = dom.fwAuthToken.value || 'demo_token';
  const server = dom.fwServerUrl.value || 'http://192.168.1.100:3000';
  const ssid = dom.fwSsid.value || 'YOUR_WIFI_SSID';
  const pass = dom.fwPass.value || 'YOUR_WIFI_PASSWORD';

  if (board === 'arduino_serial') {
    dom.fwFileNameLabel.textContent = 'arduino_usb_serial.ino';
    dom.codeBlock.textContent = `/*
 * Blynk Alter - Arduino USB Web Serial Sketch
 * Baud Rate: 115200
 */

#define RELAY_PIN 7
#define PWM_PIN   9
#define SENSOR_PIN A0

unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(PWM_PIN, OUTPUT);
  Serial.println("DEVICE:ARDUINO_UNO_READY");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd.startsWith("V2=")) {
      int s = cmd.substring(3).toInt();
      digitalWrite(RELAY_PIN, s ? HIGH : LOW);
      Serial.println("ACK:V2=" + String(s));
    } else if (cmd.startsWith("V3=")) {
      int pwm = cmd.substring(3).toInt();
      analogWrite(PWM_PIN, constrain(pwm, 0, 255));
      Serial.println("ACK:V3=" + String(pwm));
    }
  }

  if (millis() - lastSend >= 1000) {
    lastSend = millis();
    int raw = analogRead(SENSOR_PIN);
    float temp = (raw * (5.0 / 1023.0)) * 10.0;
    
    // Transmit Virtual Pins
    Serial.print("V0:"); Serial.println(temp, 1);
    Serial.print("V1:"); Serial.println(raw / 10.23, 1);
    Serial.print("V4:"); Serial.println(raw * (5.0 / 1023.0), 2);
  }
}`;
    return;
  }

  dom.fwFileNameLabel.textContent = 'esp32_wifi_blynk.ino';
  dom.codeBlock.textContent = `/*
 * Blynk Alter - ESP32 WiFi Firmware
 * Server: ${server}
 * Auth Token: ${token}
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

const char* ssid = "${ssid}";
const char* password = "${pass}";
const char* serverUrl = "${server}";
const char* token = "${token}";

#define DHTPIN 4
#define DHTTYPE DHT22
#define RELAY_PIN 18
#define PWM_PIN 23

DHT dht(DHTPIN, DHTTYPE);
unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(PWM_PIN, OUTPUT);
  dht.begin();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected: " + WiFi.localIP().toString());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (millis() - lastSend >= 2000) {
      lastSend = millis();
      float t = dht.readTemperature();
      float h = dht.readHumidity();
      float v = 3.3 + (analogRead(34) / 4095.0) * 0.9;

      HTTPClient http;
      String url = String(serverUrl) + "/api/blynk/update?token=" + token +
                   "&V0=" + String(t, 1) + "&V1=" + String(h, 1) + "&V4=" + String(v, 2);
      http.begin(url);
      int code = http.GET();
      http.end();
    }
  }
  delay(50);
}`;
}

// --- API Documentation Tester ---
function initApiTester() {
  document.querySelectorAll('.test-ep-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-url');
      const resSpan = btn.parentElement.querySelector('.test-res');
      resSpan.textContent = 'Sending...';
      try {
        const res = await fetch(url);
        const json = await res.json();
        resSpan.textContent = `Status ${res.status}: ` + JSON.stringify(json).substring(0, 40) + '...';
        resSpan.style.color = '#10B981';
      } catch (e) {
        resSpan.textContent = `Error: ${e.message}`;
        resSpan.style.color = '#F43F5E';
      }
    });
  });
}

// --- Helper Functions ---
function flashRxLed() {
  if (dom.simPcbRx) {
    dom.simPcbRx.classList.add('active');
    setTimeout(() => dom.simPcbRx.classList.remove('active'), 120);
  }
}

function flashTxLed() {
  if (dom.simPcbTx) {
    dom.simPcbTx.classList.add('active');
    setTimeout(() => dom.simPcbTx.classList.remove('active'), 120);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// --- Widget Studio Modal & Customizer ---
dom.btnAddWidget.addEventListener('click', () => {
  editingWidgetId = null;
  dom.modalTitle.textContent = 'Add New Dashboard Widget';
  dom.wTypeSelect.value = 'gauge';
  dom.wSizeSelect.value = '1';
  dom.wTitleInput.value = 'New Sensor Gauge';
  dom.wPinSelect.value = 'V0';
  dom.wMinInput.value = '0';
  dom.wMaxInput.value = '100';
  dom.wUnitInput.value = '°C';
  dom.wAlarmInput.value = '';
  dom.wColorSelect.value = '#06B6D4';
  dom.widgetModal.classList.remove('hidden');
});

dom.btnCloseModal.addEventListener('click', () => {
  dom.widgetModal.classList.add('hidden');
});

dom.btnCancelWidget.addEventListener('click', () => {
  dom.widgetModal.classList.add('hidden');
});

dom.btnSaveWidget.addEventListener('click', () => {
  const type = dom.wTypeSelect.value;
  const size = parseInt(dom.wSizeSelect.value, 10) || 1;
  const title = dom.wTitleInput.value.trim() || 'Widget';
  const pin = dom.wPinSelect.value;
  const min = parseFloat(dom.wMinInput.value) || 0;
  const max = parseFloat(dom.wMaxInput.value) || 100;
  const unit = dom.wUnitInput.value.trim();
  const alarmRaw = dom.wAlarmInput.value.trim();
  const alarmHigh = alarmRaw !== '' ? parseFloat(alarmRaw) : null;
  const color = dom.wColorSelect.value;

  if (editingWidgetId) {
    // Update existing
    const idx = state.widgets.findIndex(w => w.id === editingWidgetId);
    if (idx !== -1) {
      state.widgets[idx] = {
        ...state.widgets[idx],
        type,
        size,
        title,
        pin,
        min,
        max,
        unit,
        alarmHigh,
        color
      };
    }
  } else {
    // Add new
    state.widgets.push({
      id: `w_${Date.now()}`,
      type,
      size,
      title,
      pin,
      min,
      max,
      unit,
      alarmHigh,
      color
    });
  }

  renderWidgets();
  dom.widgetModal.classList.add('hidden');
});

// Reset Layout
dom.btnResetWidgets.addEventListener('click', () => {
  if (confirm('Reset dashboard layout to default widgets?')) {
    state.widgets = DEFAULT_WIDGETS;
    renderWidgets();
  }
});

// Export Layout JSON
dom.btnExportConfig.addEventListener('click', () => {
  const config = {
    appName: 'Blynk Alter',
    version: '1.0.0',
    deviceToken: state.token,
    widgets: state.widgets
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `blynk_alter_layout_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- Categorized AI Prompt Library ---
const PROMPT_LIBRARY = {
  telemetry: [
    { icon: '📈', label: 'Plot Temperature vs Humidity', prompt: 'Show temperature (V0) vs humidity (V1) correlation over the last 12 hours with insights' },
    { icon: '🔋', label: 'Battery Discharge Curve', prompt: 'Analyze battery voltage (V4) discharge trend and health status' },
    { icon: '📊', label: 'Hourly Peak Telemetry', prompt: 'Generate a bar chart of peak temperatures recorded today' },
    { icon: '🌡️', label: 'Thermal Range Spread', prompt: 'Show min, max, and average temperature distribution across the dataset' }
  ],
  control: [
    { icon: '⚡', label: 'Turn ON Relay & Dim LED', prompt: 'Turn ON Relay 1 (V2) and set PWM LED brightness (V3) to 80%' },
    { icon: '💡', label: 'Dim PWM LED to 25%', prompt: 'Set PWM LED brightness on pin V3 to 25%' },
    { icon: '🔌', label: 'Switch OFF Relay 1', prompt: 'Turn OFF Relay 1 on Virtual Pin V2' },
    { icon: '🎨', label: 'Set NeoPixel to Cyan', prompt: 'Set ambient lamp color on V5 to cyan #06B6D4' }
  ],
  diagnostics: [
    { icon: '⚠️', label: 'Detect Sensor Anomalies', prompt: 'Are there any temperature anomalies, voltage brownouts, or spikes in recent logs?' },
    { icon: '⏱️', label: 'Battery Runtime Estimate', prompt: 'Calculate estimated hours remaining on battery V4 at the current sampling rate' },
    { icon: '🩺', label: 'Sensor Link Stability', prompt: 'Verify all virtual pin update timestamps and check if any sensor has stalled' },
    { icon: '📋', label: 'Pin State Executive Summary', prompt: 'Provide a structured health summary of all configured virtual and hardware pins' }
  ],
  firmware: [
    { icon: '🛠️', label: 'ESP32 DHT22 + Relay Sketch', prompt: 'Generate ESP32 C++ sketch reading DHT22 on GPIO 4 and driving 5V relay on GPIO 18' },
    { icon: '🔌', label: 'Arduino Uno USB Serial', prompt: 'Generate Arduino Uno C++ sketch streaming analog sensor A0 over USB Web Serial' },
    { icon: '💤', label: 'ESP32 Deep Sleep Sketch', prompt: 'Generate battery-optimized ESP32 sketch waking from deep sleep every 10 minutes to push telemetry' },
    { icon: '📟', label: 'ESP32 with I2C OLED Display', prompt: 'Generate ESP32 sketch displaying V0 temperature and V1 humidity on SSD1306 OLED' }
  ]
};

function initPromptLibrary() {
  const catButtons = document.querySelectorAll('.prompt-cat-btn');
  let activeCat = 'telemetry';

  function renderCategory(cat) {
    dom.promptChipsGrid.innerHTML = '';
    const prompts = PROMPT_LIBRARY[cat] || [];
    prompts.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'prompt-chip-card';
      chip.innerHTML = `
        <span class="prompt-chip-icon">${item.icon}</span>
        <div>
          <strong>${item.label}</strong>
          <div style="color: var(--text-dim); font-size: 0.75rem; margin-top: 2px;">${item.prompt}</div>
        </div>
      `;
      chip.addEventListener('click', () => {
        dom.aiPromptInput.value = item.prompt;
        sendAIPrompt();
      });
      dom.promptChipsGrid.appendChild(chip);
    });
  }

  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.getAttribute('data-cat');
      renderCategory(activeCat);
    });
  });

  renderCategory(activeCat);
}

// --- Notification Hub & Webhook Dispatcher ---
function initNotificationHub() {
  // Load saved inputs
  if (dom.cfgTelegramToken) dom.cfgTelegramToken.value = notifConfig.telegramToken;
  if (dom.cfgTelegramChatId) dom.cfgTelegramChatId.value = notifConfig.telegramChatId;
  if (dom.cfgDiscordWebhook) dom.cfgDiscordWebhook.value = notifConfig.discordWebhook;
  if (dom.cfgNtfyTopic) dom.cfgNtfyTopic.value = notifConfig.ntfyTopic;

  // Save on input change
  dom.cfgTelegramToken.addEventListener('input', e => {
    notifConfig.telegramToken = e.target.value.trim();
    localStorage.setItem('cfg_tg_token', notifConfig.telegramToken);
  });
  dom.cfgTelegramChatId.addEventListener('input', e => {
    notifConfig.telegramChatId = e.target.value.trim();
    localStorage.setItem('cfg_tg_chat', notifConfig.telegramChatId);
  });
  dom.cfgDiscordWebhook.addEventListener('input', e => {
    notifConfig.discordWebhook = e.target.value.trim();
    localStorage.setItem('cfg_discord_url', notifConfig.discordWebhook);
  });
  dom.cfgNtfyTopic.addEventListener('input', e => {
    notifConfig.ntfyTopic = e.target.value.trim();
    localStorage.setItem('cfg_ntfy_topic', notifConfig.ntfyTopic);
  });

  // Test Telegram
  dom.btnTestTelegram.addEventListener('click', async () => {
    const token = dom.cfgTelegramToken.value.trim();
    const chat = dom.cfgTelegramChatId.value.trim();
    if (!token || !chat) {
      dom.stTelegram.className = 'channel-status err';
      dom.stTelegram.textContent = 'Please enter Bot Token & Chat ID';
      return;
    }
    dom.stTelegram.textContent = 'Sending...';
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent('🚀 [Blynk Alter] Test Alert: Telegram integration is working!')}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        dom.stTelegram.className = 'channel-status ok';
        dom.stTelegram.textContent = 'Message Sent! ✓';
      } else {
        dom.stTelegram.className = 'channel-status err';
        dom.stTelegram.textContent = `Error: ${data.description}`;
      }
    } catch (e) {
      dom.stTelegram.className = 'channel-status err';
      dom.stTelegram.textContent = e.message;
    }
  });

  // Test Discord Webhook
  dom.btnTestDiscord.addEventListener('click', async () => {
    const url = dom.cfgDiscordWebhook.value.trim();
    if (!url) {
      dom.stDiscord.className = 'channel-status err';
      dom.stDiscord.textContent = 'Please enter Discord Webhook URL';
      return;
    }
    dom.stDiscord.textContent = 'Sending...';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '🚀 **[Blynk Alter]** Test Alert: Discord Webhook integration is working perfectly!' })
      });
      if (res.ok || res.status === 204) {
        dom.stDiscord.className = 'channel-status ok';
        dom.stDiscord.textContent = 'Webhook Sent! ✓';
      } else {
        dom.stDiscord.className = 'channel-status err';
        dom.stDiscord.textContent = `Status: ${res.status}`;
      }
    } catch (e) {
      dom.stDiscord.className = 'channel-status err';
      dom.stDiscord.textContent = e.message;
    }
  });

  // Test Ntfy.sh
  dom.btnTestNtfy.addEventListener('click', async () => {
    const topic = dom.cfgNtfyTopic.value.trim();
    if (!topic) {
      dom.stNtfy.className = 'channel-status err';
      dom.stNtfy.textContent = 'Please enter topic name';
      return;
    }
    dom.stNtfy.textContent = 'Sending...';
    try {
      const res = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: '🚀 [Blynk Alter] Sensor Alert: Ntfy push is working!'
      });
      if (res.ok) {
        dom.stNtfy.className = 'channel-status ok';
        dom.stNtfy.textContent = 'Push Sent to Phone! ✓';
      } else {
        dom.stNtfy.className = 'channel-status err';
        dom.stNtfy.textContent = `Status ${res.status}`;
      }
    } catch (e) {
      dom.stNtfy.className = 'channel-status err';
      dom.stNtfy.textContent = e.message;
    }
  });

  // Enable Browser Native Notification
  dom.btnEnableBrowserNotif.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      dom.stBrowserNotif.className = 'channel-status err';
      dom.stBrowserNotif.textContent = 'Browser Notifications not supported';
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      notifConfig.browserEnabled = true;
      dom.stBrowserNotif.className = 'channel-status ok';
      dom.stBrowserNotif.textContent = 'Notifications Enabled! ✓';
      new Notification('🚀 Blynk Alter', { body: 'Browser notifications are active!' });
    } else {
      dom.stBrowserNotif.className = 'channel-status err';
      dom.stBrowserNotif.textContent = 'Permission Denied';
    }
  });

  // Test All Channels
  dom.btnTestAllAlerts.addEventListener('click', () => {
    dispatchAlarmNotification('V0', 38.5, 35.0, 'Ambient Temperature');
    alert('Test alert triggered! Dispatched to all configured channels (Telegram, Discord, Ntfy, Browser).');
  });
}

// --- Alarm Monitor & Auto Dispatcher ---
function checkAlarmThresholds(pin, numVal) {
  const now = Date.now();
  state.widgets.forEach(w => {
    if (w.pin === pin && w.alarmHigh !== null && w.alarmHigh !== undefined) {
      if (numVal >= w.alarmHigh) {
        const last = notifConfig.lastAlertTimes[w.id] || 0;
        if (now - last > 45000) { // 45-second cooldown per widget
          notifConfig.lastAlertTimes[w.id] = now;
          dispatchAlarmNotification(pin, numVal, w.alarmHigh, w.title);
        }
      }
    }
  });
}

function dispatchAlarmNotification(pin, value, threshold, title) {
  const message = `🚨 [BLYNK ALTER ALARM] ${title} (${pin}) is ${value} (Exceeded high threshold: ${threshold})!`;

  // 1. Browser Native Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`🚨 High Alarm: ${title}`, {
      body: `Current value: ${value} (Threshold: ${threshold})`
    });
  }

  // 2. Telegram Bot
  const tgToken = dom.cfgTelegramToken?.value?.trim() || notifConfig.telegramToken;
  const tgChat = dom.cfgTelegramChatId?.value?.trim() || notifConfig.telegramChatId;
  if (tgToken && tgChat) {
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage?chat_id=${tgChat}&text=${encodeURIComponent(message)}`).catch(() => {});
  }

  // 3. Discord Webhook
  const discordUrl = dom.cfgDiscordWebhook?.value?.trim() || notifConfig.discordWebhook;
  if (discordUrl) {
    fetch(discordUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `**${message}**` })
    }).catch(() => {});
  }

  // 4. Ntfy.sh Phone Push
  const ntfyTopic = dom.cfgNtfyTopic?.value?.trim() || notifConfig.ntfyTopic;
  if (ntfyTopic) {
    fetch(`https://ntfy.sh/${ntfyTopic}`, {
      method: 'POST',
      headers: { 'Title': `🚨 Alert: ${title}`, 'Priority': 'high' },
      body: message
    }).catch(() => {});
  }
}


