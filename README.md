
# Parrot Pi

This is a modular, portable cyberdeck environment built for the Raspberry Pi 5 running Parrot OS. Designed for edge telemetry, signal monitoring, spatial analysis, and hardware diagnostic tasks, a Lumino/JupyterLab-style web workspace with dynamic widget panels powered by a unified TypeScript `MODULE_REGISTRY`.

---

## 🛠️ System Overview & Specifications

### Core Compute & OS

* **SBC:** Raspberry Pi 5 (8GB RAM) with active cooling and PCIe 2.0 NVMe storage.
* **Operating System:** Parrot OS (ARM64) Security Edition.
* **Power Management:** Dual 18V Ryobi ONE+ battery UPS system with automatic AC transfer bypass, XL4016 step-down regulation, LC $\pi$-filtering, and ADS1115 I2C battery voltage/temperature telemetry.
* **Display Output:** Dual-display setup (Primary LCD workspace + Secondary projection/monitoring output).


---

## 📡 Panel Group Descriptions

### Core System & Management

* **Status (`StatusWidget`):** Task manager showing CPU temperatures, SoC throttling flags, memory usage, power rail voltages, and battery telemetry from the ADS1115 ADC.
* **Wifi Status (`WifiWidget`):** Active network state, signal strength analyzer, channel distribution graphs, and scan results via `nmcli`/`iw`.
* **GPS Location (`GPSWidget`):** Real-time mapping, speed over ground, satellite constellation locks, and spatial tagging via `gpsd`.
* **Remote Desktop (`RemoteWidget`):** Remote control interface for VNC, Synergy/Input Leap, or web-based terminal sessions.
* **Settings (`SettingsWidget`):** Live JSON configuration editor for adjusting polling intervals, threshold alerts, and device path mounts.

### Signals & RF Processing

* **Signals Intelligence (`SDRWidget`):** Auto-detects connected RTL-SDR dongles to provide air domain awareness (1090MHz ADS-B aircraft tracking), maritime AIS ship telemetry, and 315MHz/433MHz sub-GHz signal decoding (`rtl_433`).
* **Proximity Radar (`BLERadarWidget`):** Tracks nearby Bluetooth Low Energy devices, smartwatches, and beacon tags using `bluetoothctl`, plotting RSSI proximity levels.
* **Cellular & Telemetry (`CellularWidget`):** Interface for attached USB LTE/5G modems to display active cell tower IDs, signal quality (RSRP/RSRQ), and carrier metadata via `ModemManager`.

### Optics, Vision & Spatial Analysis

* **Camera (`CameraWidget`):** Live video feed management for dual-CSI or USB webcams with optical flow speed estimation and movement tracking.
* **Computer Vision & ALPR (`VisionWidget`):** Localized machine vision panel executing ONNX Runtime inference for automatic license plate recognition (`fast-alpr`), person counting, and bounding box displays.
* **3D Photogrammetry (`Scanner3DWidget`):** Structured light 3D scanning interface that drives Gray code pattern projection over HDMI-2 while capturing spatial camera displacement to build point clouds.

### Acoustic & Sensor Diagnostics

* **Acoustic Spectrum (`AudioSpectrumWidget`):** Audio FFT spectrogram visualizing microphone inputs to identify peak frequencies, ultrasonic acoustic signals (18kHz–24kHz), and ambient decibel levels.

### Code & Automation Workspace

* **Code Editor (`AceEditorWidget`):** Integrated web editor for modifying local scripts and workflow configurations.
* **Terminal (`TerminalWidget`):** Browser-rendered terminal emulation (xterm.js) providing direct shell access to Parrot OS.
* **Workflow Graph (`LightGraphWidget`):** Visual node-graph canvas (LiteGraph) for chaining telemetry streams, alert triggers, and database logging routines.
* **File & Data Management (`FileListWidget`, `SearchListWidget`, `DatabaseListWidget`, `GithubListWidget`):** Tools for navigating engine files, querying local SQLite event logs, and managing Git repository commits directly from the workstation UI.


# Tactical Cyberdeck Workstation & Dual UPS System

A custom, rugged, portable cyberdeck workstation built inside a utility trunk. The system combines high-performance ARM64 hardware with a zero-solder, low-noise DC-to-DC UPS power distribution system powered by dual Ryobi 18V ONE+ battery packs.

---

## Hardware Specifications

* **Compute Unit:** Raspberry Pi 5 (ARM64) running **Parrot Security OS** off a PCIe NVMe SSD.
* **Display:** Dell S2440L 24" Monitor ($12\text{V}$ native DC input, $22.2"$ wide panel).
* **Storage Interface:** 16-pin $0.5\text{mm}$ pitch PCIe flex cable to M.2 NVMe HAT+ adapter board.
* **Power Controller:** Konnected ESP8266 board (AMS1117-3.3 regulator, CH340G USB, $A0$ ADC pin for battery sampling).
* **Primary Battery System:** $2\times$ Ryobi 18V ONE+ Lithium-Ion packs connected in parallel via Ideal Diode isolation.
* **Secondary AC Inverter:** Ryobi $150\text{W}$ Power Source (RYi150BG) for $120\text{V}$ AC failover.
* **Outer Enclosure:** Heavy-duty utility trunk / rolling hard case (min. $22.5"$ interior width clearance).

---

## System Architecture & Circuit Schematic

```
                          [ 120V AC Grid Wall Plug ]
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
                 ▼                                         ▼
┌────────────────────────────────┐        ┌────────────────────────────────┐
│ AC-to-DC Wall Power Adapter    │        │ DPDT AC Transfer Relay         │
│ (20V DC / 10A Output)          │        │ (120V AC Coil / 15A Contacts)  │
└────────────────┬───────────────┘        └───────────────┬────────────────┘
                 │                                        │
                 │ (Primary DC Bus)                       │ (120V AC Pass-Through)
                 ▼                                        │
┌────────────────────────────────┐                        │
│ Ideal Diode A (AC Priority)    │                        │
└────────────────┬───────────────┘                        │
                 │                                        │
                 │                                        ▼
                 │                      ┌──────────────────────────────────┐
                 ├───[ Charge Bus ]──┐  │ 120V AC Output Power Strip       │
                 │                   │  └──────────────────────────────────┘
                 │                   │                    ▲
                 ▼                   ▼                    │
      ┌────────────────────┐ ┌────────────────────┐       │
      │ Ryobi Pack 1 (18V) │ │ Ryobi Pack 2 (18V) │       │
      └─────────┬──────────┘ └─────────┬──────────┘       │
                │                      │                  │
                ▼                      ▼                  │
      ┌────────────────────┐ ┌────────────────────┐       │
      │ Ideal Diode B1     │ │ Ideal Diode B2     │       │
      └─────────┬──────────┘ └─────────┬──────────┘       │
                │                      │                  │
                └───────────┬──────────┘                  │
                            │ (Shared Battery Bus)        │
                            ▼                             │
┌─────────────────────────────────────────────────┐       │
│ Ryobi 150W Inverter (RYi150BG)                  ├───────┘
└───────────────────────────┬─────────────────────┘ (120V Inverter Failover)
                            │
                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MAIN UNFILTERED DC BUS BAR                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               LOW-VOLTAGE DISCONNECT RELAY (XH-M609)                   │
│              (Triggers cut-off at 15.0V to protect batteries)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FILTERED STEP-DOWN VOLTAGE RAILS                     │
├───────────────────────────────────┬────────────────────────────────────┤
│ 12V RAIL (Monitor & Peripherals)  │ 5V RAIL (Raspberry Pi 5 Core)      │
│                                   │                                    │
│ [ XL4016 8A Buck Converter ]      │ [ 5V 5A High-Efficiency Buck ]     │
│                 │                 │                 │                  │
│                 ▼                 │                 ▼                  │
│ [ Pi-Filter (4.7uH + 470uF Cap) ] │ [ Pi-Filter (2.2uH + 1000uF Cap) ]│
│                 │                 │                 │                  │
│                 ▼                 │                 ▼                  │
│ [ 12V Terminal Bus Bar ]          │ [ 5V Terminal Bus Bar / USB-C ]    │
└───────────────────────────────────┴────────────────────────────────────┘

```

---

## Bill of Materials (BOM)

### Power System & Conversion

* **AC Wall Power Supply:** ALITOVE 20V 10A 200W AC to DC Adapter (`ALITOVE-20V10A`)
* **Ideal Diode Module:** 3-Channel 20A Ideal Diode Board (`BrownieBoards` / `LTC4352`)
* **Battery Charger Module:** DROK 300W 20A CC/CV Step-Down Buck Converter (`DROK-200008`)
* **Low-Voltage Disconnect:** XH-M609 DC 12V–36V Battery LVD Protection Module (`XH-M609`)
* **12V Step-Down Buck:** XL4016 8A 100W Adjustable Buck Regulator (`XL4016`)
* **5V Step-Down Buck:** Type-C USB 5V 5A Step-Down Module (`Pi5-5V5A`)
* **AC Transfer Relay:** DPDT 120V AC Power Relay with DIN Socket Base (`LY2N-AC120`)

### Wiring, Pass-Throughs & Distribution

* **High-Current Cable Assemblies:** AMASS XT60H 12AWG Pre-Wired Connectors (`AMASS-XT60H-M/F`)
* **Panel Mount Power Input:** CNLINKO 2-Pin IP68 Waterproof Bulkhead Connector (`CNLINKO-LP-12-C02`)
* **Power Distribution:** Dual-Row 6-Position 15A Terminal Block Bus Bars (`TB-1506`)
* **Wire Termination:** Wire Ferrule Terminal Kit & Crimper Tool (`HSC8 6-4A`)

### Low-Noise Power Filtering

* **12V Inductor ($L_1$):** $4.7\,\mu\text{H}$ Shielded Power Inductor (10A rated)
* **12V Filter Capacitors:** $470\,\mu\text{F}$ Low-ESR Electrolytic ($25\text{V}$) + $0.1\,\mu\text{F}$ MLCC Ceramic
* **5V Inductor ($L_1$):** $2.2\,\mu\text{H}$ Shielded Power Inductor (6A rated)
* **5V Filter Capacitors:** $1000\,\mu\text{F}$ Low-ESR Electrolytic ($10\text{V}$) + $10\,\mu\text{F}$ MLCC Ceramic
* **EMI Suppression:** Snap-On Ferrite Core Beads (`TDK-ZCAT-Kit`)

---

## Operating Principles & Safety Guidelines

1. **Parallel Battery Isolation (Zero Backfeed):**
* Ryobi Pack 1 and Pack 2 route through dedicated **Ideal Diodes (B1 & B2)** before connecting to the main DC bus.
* If Pack 1 is at $20\text{V}$ and Pack 2 is at $17\text{V}$, Diode B2 instantly shuts off. Pack 1 drains down to $17\text{V}$, at which point both packs balance seamlessly without current backfeeding into the lower-voltage battery.


2. **AC Grid Priority (Seamless Failover):**
* The wall power supply outputs $20\text{V}$ DC, which is higher than the max Ryobi battery voltage ($19.5\text{V}$).
* **Ideal Diode A** holds Diodes B1 and B2 in off-state when wall power is present. Unplugging the AC cable engages the battery diodes in $<1\,\mu\text{s}$, preventing system reboot.


3. **Low-Voltage Disconnect (LVD):**
* The **XH-M609 module** is programmed to cut the main load at **$15.0\text{V}$**. This prevents over-discharge damage to the Ryobi 18V lithium-ion cells.


4. **120V AC Pass-Through Relay:**
* The DPDT relay coil is energized directly by wall AC power.
* **Grid Power Active:** Relay snaps to Normally Open (NO), routing utility AC directly to the internal power strip. The Ryobi $150\text{W}$ inverter remains idle.
* **Grid Power Loss:** Relay drops to Normally Closed (NC), feeding the power strip from the Ryobi $150\text{W}$ inverter.


5. **Ryobi Stem Interface:**
* **`(+)` and `(-)` Blades:** High-current power discharge rails.
* **`T` Pin:** Internal $10\text{k}\Omega$ NTC thermistor tied to `(-)`. Sampled via a voltage divider into an **ADS1115 ADC** module connected to the Raspberry Pi 5 I2C bus (`SDA`/`SCL`).



---

## Input Devices & OS Deployment

* **OS Distribution:** **Parrot Security OS (ARM64 Edition)** flashed to an NVMe SSD.
* **Primary Wireless Input Options (Pure Bluetooth HID):**
* *Tap Strap 2 Wearable Controller:* Wearable gesture/finger-tap input.
* *Bastron Glass Capacitive Touch Keyboard:* Illuminated tempered-glass surface (IP67/waterproof).
* *Elecom Relacon / Ring Trackball:* Handheld thumb-trackball controller.


* **Automated Bluetooth Pairing (`bluetoothctl`):**
```bash
bluetoothctl
scan on
pair XX:XX:XX:XX:XX:XX
connect XX:XX:XX:XX:XX:XX
trust XX:XX:XX:XX:XX:XX

```
