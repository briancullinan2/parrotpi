Here is a architectural breakdown and complete, modern `README.md` for migrating the **`briancullinan2/mediaserver`** project from its original PHP/Ampache server-centric architecture to a modern, browser-native JavaScript/TypeScript client-side media server.

---

### Architectural Transformation Summary

| Feature | Legacy PHP Architecture | New Browser-Native JavaScript Architecture |
| --- | --- | --- |
| **Runtime & Server** | PHP 7+ Front Controller (`index.php`), Apache/Nginx, SQLite/MySQL | Pure Client-Side SPA (TypeScript/HTML5), Service Workers, Web Workers |
| **Database & Indexing** | Server-side relational DB via `includes/db.inc` | **OPFS SQLite WASM** via `@sqlite.org/sqlite-wasm` or **IndexedDB** |
| **Transcoding & Media** | Server FFmpeg / VLC execution via `encode.module` | **FFmpeg.wasm** inside dedicated **Web Workers** for client-side encoding |
| **File Access & Storage** | Server-side directory crawling (`files.module`, `cron.php`) | **File System Access API** (`window.showDirectoryPicker()`) with OPFS persistence |
| **Torrents & Downloader** | Server-side downloading (`download.module`) | **WebTorrent** in browser using WebSockets/SOCKS5 proxy signaling |
| **P2P & Local Sharing** | WebDAV / Ampache API endpoints | **WebRTC DataChannels** for direct P2P mesh browser-to-browser streaming |

---

# Modern MediaServer JS

> A 100% client-side, zero-backend media server, stream engine, and P2P distribution network running entirely inside the web browser.

`mediaserver-js` re-imagines the classic monolithic PHP `Atlas/mediaserver` platform as a high-performance, browser-native web application. Utilizing modern Web APIs (WebAssembly, Web Workers, File System Access API, OPFS, WebRTC, and WebSockets), this project indexes local file systems, transcodes media client-side, streams via BitTorrent/WebRTC, and shares files across browsers—without sending media content through a centralized server.

---

## Key Features

- 📁 **Local Directory Mounts & Indexing**: Mount local directories directly via the File System Access API. File metadata and media trees are persisted using SQLite compiled to WebAssembly inside Origin Private File System (OPFS).
- ⚙️ **Client-Side Transcoding (Web Workers)**: Transcode video and audio formats (MKV, AVI, FLAC, AC3) directly in background Web Workers using `@ffmpeg/ffmpeg` (FFmpeg.wasm).
- 🌐 **BitTorrent over WebSockets**: Connect to the BitTorrent network using client-side WebTorrent routed through WebSocket trackers or custom SOCKS5 proxy adapters.
- 🔄 **Browser-to-Browser P2P Mesh**: Stream local media directly to other client browser tabs using WebRTC DataChannels for zero-latency local network or remote sharing.
- ⚡ **Offline-First PWA**: Service Workers cache UI assets, database interfaces, and stream parsers for full offline usage.

---

## Architecture Overview


```

```
                  +-------------------------------------------------------+
                  |                   Browser Tab (UI)                    |
                  |  - React/Lit UI Component Tree                        |
                  |  - HTML5 Video / WebAudio Render Pipeline             |
                  +-----------+----------------------+--------------------+
                              |                      |
        +---------------------+                      +----------------------+
        |                                                                   |
        v                                                                   v

```

+-----------------------+                                              +-----------------+
|   Main Web Worker     |                                              |   Web Worker    |
| (Database & Engine)   |                                              |  (Transcoder)   |
|                       |                                              |                 |
|  - SQLite WASM (OPFS) |                                              |  - FFmpeg.wasm  |
|  - Metadata Indexer   |                                              |  - Demuxer      |
|  - Router & API       |                                              |  - Chunk Pipeline
+-----------+-----------+                                              +-----------------+
|
+-----------------------+-----------------------+
|                       |                       |
v                       v                       v
+----------------------+  +-------------------+  +--------------------+
| File System Access   |  |   WebTorrent /    |  |   WebRTC Peer      |
|     API / OPFS       |  | WebSocket Proxy   |  |   DataChannels     |
| (Local Disks & Repos)|  | (BitTorrent Swarm)|  | (Local/Remote P2P) |
+----------------------+  +-------------------+  +--------------------+

```

---

## Core Technologies & Dependencies

* **Language/Bundler**: TypeScript, Vite
* **Database**: `@sqlite.org/sqlite-wasm` (persisted to OPFS)
* **Transcoding Engine**: `@ffmpeg/ffmpeg`, `@ffmpeg/util` (FFmpeg compiled to WASM)
* **Local File System**: File System Access API (`showDirectoryPicker`)
* **Torrent Engine**: `webtorrent` (configured with WebSocket-to-TCP tracker gateways)
* **P2P Networking**: WebRTC (`simple-peer` or native `RTCPeerConnection`)

---

## Getting Started

### Prerequisites

* Node.js v18.0.0 or higher
* Modern Chromium-based browser or Firefox (supporting SharedArrayBuffer, Web Assembly, and OPFS)

### Installation

```bash
# Clone the repository
git clone [https://github.com/briancullinan2/mediaserver.git](https://github.com/briancullinan2/mediaserver.git)
cd mediaserver

# Install dependencies
npm install

# Start local development server with required COOP/COEP headers
npm run dev

```

> **Note on SharedArrayBuffer**: Multithreaded FFmpeg.wasm requires Cross-Origin Isolation. The Vite dev server is preconfigured with the following headers:
> ```http
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Embedder-Policy: require-corp
>
> ```
>
>

---

## Module Breakdown

### 1. File Indexer & Storage Layer (`src/core/fs/`)

* Mounts local folders using `window.showDirectoryPicker()`.
* Recursively walks file paths and stores inode metadata in SQLite WASM.
* Generates persistent file handles in OPFS for zero-copy stream reading using `FileSystemFileHandle.getFile()`.

### 2. Worker Transcoder (`src/workers/transcoder.worker.ts`)

* Executes inside a dedicated `Worker` context.
* Consumes binary chunks via `ReadableStream` or `Blob.slice()`.
* Converts incompatible video containers (e.g., MKV/HEVC to MP4/H.264) on the fly and returns fragmented MP4 streams for MSE (`MediaSource`) consumption.

### 3. BitTorrent WebSocket Gateway (`src/network/torrent/`)

* Uses `webtorrent` in pure client-side mode.
* Communicates with public BitTorrent swarms via WebSocket-to-TCP bridge proxies or native WebRTC torrent seeds.

### 4. P2P Sharing Subsystem (`src/network/p2p/`)

* Establishes direct WebRTC data pipes between running browser tabs.
* Allows Tab A (holding local file handles) to serve video segments directly to Tab B without uploading files to a cloud server.

---

## Project Structure

```
mediaserver/
├── public/
│   ├── ffmpeg/             # Static WASM binaries for FFmpeg
│   └── favicon.ico
├── src/
│   ├── components/         # UI Elements, Video Player, File Explorer
│   ├── core/
│   │   ├── db/             # SQLite WASM initialization & schema migrations
│   │   ├── fs/             # File System Access API wrappers & OPFS drivers
│   │   └── media/          # Demuxers, MediaSource Extensions (MSE) pipeline
│   ├── network/
│   │   ├── bittorrent/     # WebTorrent integration & proxy client
│   │   └── p2p/            # WebRTC peer connection manager
│   ├── workers/
│   │   ├── indexer.worker.ts
│   │   └── transcoder.worker.ts
│   ├── main.ts             # Application entrypoint
│   └── service-worker.ts   # PWA offline asset caching
├── package.json
├── tsconfig.json
└── vite.config.ts

```

---

## Production Build & Deployment

Because `mediaserver-js` is completely client-side, the build output consists of static assets that can be hosted on any static site hosting service (GitHub Pages, Cloudflare Pages, Vercel, or Nginx).

```bash
# Build the production package
npm run build

# Preview production build locally
npm run preview

```

### Static Hosting Header Configuration

Ensure your web host provides cross-origin isolation headers for multithreaded WASM support:

```nginx
# Nginx configuration snippet
location / {
    add_header Cross-Origin-Opener-Policy "same-origin";
    add_header Cross-Origin-Embedder-Policy "require-corp";
}

```
