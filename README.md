# ⚡ Blynk Alter (Clynk)

> **Next-Gen AI IoT Telemetry & Control Platform (Modern Blynk Alternative)**  
> 100% Zero-Dependency · In-Browser USB Web Serial · Drop-in Blynk REST API · AI Copilot

---

## 🌟 Key Features

1. **🔌 Multi-Channel Hardware Port Reading:**
   * **Direct USB Web Serial API:** Plug your Arduino or ESP32 into your laptop via USB and stream telemetry (`V0:24.5`, `A0:1023`) directly into Google Chrome / Microsoft Edge with **Zero Server Setup**!
   * **Wi-Fi / Ethernet HTTP REST:** Drop-in compatible with Blynk endpoints (`/api/blynk/update?token=xyz&pin=V0&value=25.4` or multi-pin `?token=xyz&V0=25.4&V1=58.2&V2=1`).

2. **📊 Dynamic Widget Studio & Property Inspector:**
   * Radial Gauges & Dials (with customizable min/max, units, and smooth animations)
   * Real-Time Multi-Series Oscilloscope Charts (Chart.js 60fps streaming)
   * Tactile Relay Switches & Push Buttons
   * PWM Dimmers & Slider Controls (0–255 duty cycle)
   * NeoPixel RGB Color Wheel (HEX / RGB picker)
   * 16x2 LCD Character Matrix
   * **1-Click Widget Resizing (`1x`, `2x`, `3x`)** and layout persistence with `localStorage`.

3. **🔬 Virtual ESP32 Hardware Bench & Simulator:**
   * Built-in interactive simulator with DHT22 temp/humidity sliders, analog potentiometer (A0 battery voltage), 2-channel relay board, and PWM LED.
   * Auto-Waveform Generator for testing without physical hardware.

4. **🧠 AI IoT Copilot & Telemetry Brain:**
   * Natural Language Telemetry Queries: *"Show temperature vs humidity over the last 12 hours"* &rarr; generates dynamic animated charts + AI insights.
   * Natural Language Pin Control: *"Turn on relay 1 and dim LED to 80%"* &rarr; immediately actuates Virtual Pins V2 and V3.
   * 16 One-Click Test Prompts across Telemetry, Control, Diagnostics, and Firmware.

5. **⚡ Zero-Friction Notification Hub:**
   * Telegram Bot API, Discord Webhook, Ntfy.sh Phone Push, and HTML5 Native Browser Notifications (no Meta/WhatsApp phone verification needed!).

---

## 🚀 How to Run

### 1. 💻 Local Offline Server (Localhost)
```bash
# Start server with Node.js or agy-node
node server.js
```
Open **`http://localhost:3000`** in your browser.

---

### 2. ▲ Vercel Cloud Hosting (1-Click)
1. Push this folder to your GitHub repository.
2. Connect the repo to Vercel at [vercel.com/new](https://vercel.com/new).
3. Click **Deploy**!
4. Your ESP32 anywhere in the world can now send data to:
   ```http
   https://your-app.vercel.app/api/blynk/update?token=demo_token&V0=24.5&V1=58.2
   ```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` / `POST` | `/api/blynk/update?token={TOKEN}&pin={PIN}&value={VAL}` | Single Virtual Pin update |
| `GET` / `POST` | `/api/blynk/update?token={TOKEN}&V0=25.4&V1=58.2&V2=1` | Multi-Pin batch update |
| `GET` | `/api/blynk/get?token={TOKEN}&pin={PIN}` | Read Pin value |
| `GET` | `/api/blynk/history?token={TOKEN}&pin={PIN}&limit=50` | Read historical telemetry |
| `POST` | `/api/ai/query` | AI natural language query & reasoning |
