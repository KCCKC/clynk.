# ⚡ Blynk Alter — Next-Gen AI IoT Telemetry & Control Platform

> An open-source, AI-powered alternative to **Blynk** for **ESP32, Arduino, Raspberry Pi, and Microcontrollers**. Features direct browser **USB Web Serial COM port reading**, standard **Blynk-compatible REST APIs**, dynamic real-time telemetry charts, virtual hardware bench, and an **AI IoT Copilot**.

---

## 🌟 Key Features

1. **🔌 Multi-Channel Hardware Port Reading**:
   - **Direct USB Web Serial API**: Plug your Arduino or ESP32 into your laptop via USB and read serial streams (`V0:24.5`, `A0:1023`, JSON, CSV) directly in Google Chrome / Microsoft Edge with **Zero Server Setup**!
   - **WiFi / Ethernet HTTP REST**: Drop-in compatible with Blynk endpoints (`/api/blynk/update?token=xyz&pin=V0&value=25.4` or multi-pin `?token=xyz&V0=25.4&V1=58.2&V2=1`).
   - **Real-Time Live SSE & WebSocket Sync**: Sub-millisecond bi-directional datastreams.

2. **📊 Dynamic Blynk-Style Widget Studio**:
   - **Radial Gauges & Dials** (with customizable min/max, units, and smooth needle animations)
   - **Real-Time Multi-Series Oscilloscope Charts** (Canvas/Chart.js 60fps streaming, timeframes, CSV export)
   - **Tactile Relay Switches & Push Buttons** (with contact state glow)
   - **PWM Dimmers & Slider Controls** (0-255 duty cycle, servo angles)
   - **NeoPixel RGB Color Wheel** (HEX / RGB control for WS2812B LED strips)
   - **16x2 LCD Character Matrix** (retro backlit green/blue LCD display)
   - **Terminal & Serial Monitor** (ANSI color logs, TX/RX bytes counters, auto-scroll, command prompt)

3. **🔬 Virtual ESP32 Hardware Bench & Simulator**:
   - Built-in interactive simulator with DHT22 temp/humidity sliders, analog potentiometer (A0 battery voltage), 2-channel relay board, and PWM LED.
   - **Auto-Waveform Generator** for continuous live telemetry testing without physical hardware.

4. **🧠 AI IoT Copilot & Telemetry Brain**:
   - **Natural Language Telemetry Queries**: *"Show temperature vs humidity over the last 12 hours"* -> generates dynamic animated charts + AI insights.
   - **Natural Language Pin Control**: *"Turn on relay 1 and dim LED to 80%"* -> immediately actuates Virtual Pins `V2` and `V3`.
   - **Automated Anomaly Detection & Diagnostics**: Flags sensor disconnects, battery discharge anomalies, and temperature spikes.

5. **⚡ C++ Firmware Studio**:
   - 1-click generator for **ESP32 WiFi**, **Arduino USB Serial**, and **ESP8266** sketches with your Auth Token and Pin mappings pre-configured.

---

## 🚀 Deployment Options

### 1. 💻 Localhost (Home Server / Raspberry Pi / PC)

```bash
# Start server using Node.js or agy-node
node server.js
# or
agy-node server.js
```
Open **`http://localhost:3000`** in your browser.

---

### 2. ▲ Vercel (1-Click Cloud Hosting — Worldwide Access)

1. Push this repository to **GitHub**.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Click **Deploy**!
4. Your ESP32 anywhere in the world can now send telemetry to:
   ```
   https://your-app.vercel.app/api/blynk/update?token=demo_token&V0=24.5&V1=58.2
   ```

---

### 3. 🐙 GitHub Pages (Static Hosting)

1. Enable GitHub Pages in your repository settings pointing to the `public/` directory (or root).
2. The **USB Web Serial API** and **Virtual Hardware Bench** work 100% directly inside the browser with zero backend server required!

---

## 📡 Blynk REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` / `POST` | `/api/blynk/update?token={TOKEN}&pin={PIN}&value={VAL}` | Update single pin |
| `GET` / `POST` | `/api/blynk/update?token={TOKEN}&V0=25.4&V1=58.2&V2=1` | Batch update multiple pins |
| `GET` | `/api/blynk/get?token={TOKEN}&pin={PIN}` | Get pin value (returns `["25.4"]`) |
| `GET` | `/api/blynk/get?token={TOKEN}&pin={PIN}&format=raw` | Get raw pin string (e.g. `25.4`) |
| `GET` | `/api/blynk/history?token={TOKEN}&pin={PIN}&limit=100` | Get timestamped historical logs |
| `GET` | `/api/blynk/events` | Server-Sent Events (SSE) live datastream |
| `POST` | `/api/ai/query` | Natural language AI query & pin actuation |

---

## 🔌 Microcontroller Wiring & Quickstart

### ESP32 WiFi Wiring (`firmware/esp32_wifi_blynk.ino`)
- **DHT22 Data**: GPIO 4
- **Relay IN**: GPIO 18
- **PWM LED / Actuator**: GPIO 23
- **Battery ADC Divider**: GPIO 34

### Arduino Uno / Nano USB Serial (`firmware/arduino_usb_serial.ino`)
- Connect via standard USB cable.
- In **Web Serial Studio**, select `115200` baud and click **Connect USB Port**.
- Pin mappings:
  - **A0**: Potentiometer / Analog Sensor -> Streams to `V0` & `V4`
  - **D7**: Relay Module -> Controlled by `V2`
  - **D9**: PWM LED -> Controlled by `V3`
