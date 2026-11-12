# Unframed

**Local 4K Art Mode studio and gallery for Samsung The Frame TVs — zero cloud, zero SmartThings, zero telemetry.**

Samsung's official way to upload your own photos to The Frame requires signing into a Samsung account, installing the SmartThings mobile app, and letting the TV phone home to Samsung's cloud servers. If you firewall your TV from the internet to block ACR/telemetry, the mobile app stops working.

**Unframed** auto-detects Samsung The Frame TVs on your local network and talks directly to them using Samsung's on-device `com.samsung.art-app` WebSocket channel (`:8002`) and ephemeral Device-to-Device (D2D) TLS sockets. Drop any photo into the browser studio, pan/zoom/crop to 16:9 `3840 × 2160` UHD, preview mattes in real time, and push straight to the wall.

---

## Features

- **Zero-Config LAN Auto-Discovery**
  - Automatically finds Samsung The Frame TVs on your LAN in ~1.5 seconds using SSDP multicast (`M-SEARCH`) combined with a concurrent `/24` port-8001 `/api/v2/` capability scan (`FrameTVSupport == "true"`).
  - Works out of the box even inside a bridge-networked Docker container, and automatically re-discovers your TV if its DHCP IP address changes.
  - Supports multiple Frame TVs on the same network with a header picker and on-demand **Scan LAN** button.
- **100% Local LAN Protocol (Art API 4.x / 5.x)**
  - Short-lived, thread-safe TLS WebSocket sessions (`wss://<tv-ip>:8002/api/v2/channels/com.samsung.art-app`) opened only on demand so the TV never suffers from persistent socket lockups.
  - Direct D2D TLS binary socket transfers for instant 4K image uploads (`send_image`) and thumbnail downloads (`get_thumbnail_list`).
  - Automatic first-run token pairing and per-TV persistence — or bring an existing token from Home Assistant.
- **Interactive 4K UHD Cropper (`3840 × 2160`)**
  - Drag-and-drop JPEG, PNG, or WebP images.
  - Smooth pan, wheel/pinch zoom (`1.0×`–`4.0×`), 90° rotation, Fit/Fill modes, and a Rule-of-Thirds alignment grid.
  - Client-side 4K offscreen canvas rendering + server-side Pillow Lanczos pipeline with EXIF orientation normalization and 4:4:4 chroma (`subsampling=0`, quality `95`).
- **Realistic Matte & Filter Simulator**
  - Live preview of Samsung's matte styles (`none`, `modernthin`, `modern`, `modernwide`, `flexible`, `shadowbox`, `panoramic`) with beveled mat board simulation.
  - All 16 official Samsung matte colors (`polar`, `warm`, `antique`, `neutral`, `black`, `sand`, `seafoam`, `sage`, `burgandy`, `navy`, `apricot`, `byzantine`, `lavender`, `redorange`, `skyblue`, `turquoise`).
  - All 7 built-in photo filters (`None`, `Aqua`, `ArtDeco`, `Ink`, `Wash`, `Pastel`, `Feuve`).
- **Live "My Collection" (`MY-C0002`) TV Gallery**
  - Browse every personal photo stored on the TV with locally cached thumbnails.
  - **Display Now** to switch the active artwork, **Apply Matte** to restyle an already-uploaded photo in place without re-uploading, or **Delete** from TV storage.
  - Top bar controls for toggling **Art Mode** (`ON`/`OFF`) and configuring slideshow intervals & shuffle.

---

## Architecture

```
                                      ┌─────────────────────────────────────┐
                                      │   Samsung The Frame TV (LAN-Only)   │
                                      │   - :8001/api/v2/ (Discovery)       │
                                      │   - :8002 WebSocket (Art Channel)   │
                                      │   - :<ephemeral> D2D TLS Socket     │
                                      └──────▲───────────────────────▲──────┘
                                             │                       │
                             WebSocket (TLS) │                       │ D2D Socket (TLS)
                         :8002 com.samsung.art-app                   │ 4K Upload / Thumbnails
                                             │                       │
┌─────────────────────────┐           ┌──────┴───────────────────────┴──────┐
│  Unframed Studio Web UI │ ◄───────► │  FastAPI Backend (unframed:8000)    │
│  - 16:9 4K UHD Cropper  │  REST API │  - LAN Auto-Discovery (SSDP + /24)  │
│  - 16-Color Matte Sim   │           │  - FrameTVClient (frame_tv.py)      │
│  - Live TV Gallery      │           │  - Pillow 4K Pipeline (main.py)     │
└─────────────────────────┘           └─────────────────────────────────────┘
```

---

## Quickstart (Docker Compose — Zero Configuration Required)

1. **Clone and start:**

   ```bash
   git clone https://github.com/aaclarker/unframed.git
   cd unframed
   docker compose up -d --build
   ```

2. **Open `http://localhost:8094`**
   - **Auto-Detection**: Make sure your Frame TV is powered on (or in Art Mode). Unframed automatically scans your LAN, locates your TV, and persists its IP and model in `/data/.tv_state.json`.
   - **First-time pairing**: On first connection, your TV will display an *"Allow Unframed to connect?"* prompt on screen. Click **Allow** on your TV remote — Unframed will automatically save the issued token to its persistent `/data` volume so you never have to pair again.
   - **Optional `.env`**: If your TV is on a separate routed VLAN or you want to pre-seed an existing Home Assistant token, copy `.env.example` to `.env` and set `FRAME_TV_IP`, `FRAME_TV_SUBNET`, or `FRAME_TV_TOKEN`.

---

## Running Locally (Without Docker)

Requires Python 3.12+ and [`uv`](https://docs.astral.sh/uv/):

```bash
cd app
uv run --with-requirements pyproject.toml uvicorn main:app --host 127.0.0.1 --port 8094
```

---

## Environment Variables (All Optional)

| Variable | Default | Description |
|---|---|---|
| `FRAME_TV_IP` | *(auto-detected)* | Optional static LAN IP of your Samsung The Frame TV |
| `FRAME_TV_SUBNET` | *(auto-detected)* | Optional `/24` subnet hint for LAN auto-discovery (e.g. `192.168.1.0/24`) |
| `FRAME_TV_PORT` | `8002` | TLS WebSocket port on the TV (`8002` for TLS) |
| `FRAME_TV_WS_NAME` | `Unframed` | Client name (plain text or base64-encoded) sent during WebSocket handshake |
| `FRAME_TV_TOKEN` | *(auto-saved)* | 8-digit pairing token; if omitted, persisted automatically per TV on first approval |
| `FRAME_TV_MODEL` | *(auto-discovered)* | Optional override for the TV model badge (otherwise queried from `http://<ip>:8001/api/v2/`) |
| `THUMB_CACHE_DIR` | `/data/thumbs` | Directory for cached TV gallery thumbnails |
| `FRAME_TV_TOKEN_FILE` | `/data/.tv_token` | File path where the paired TV token is persisted |
| `FRAME_TV_STATE_FILE` | `/data/.tv_state.json` | File path where discovered TVs and per-IP tokens are persisted |
| `PORT` | `8094` | Host port mapped by `docker-compose.yml` |

---

## REST API Reference

- **`GET /healthz`** — Healthcheck (`{"ok": true}`).
- **`GET /api/status`** — Live TV status, active artwork, `my_photos` (`MY-C0002`), `discovered_tvs`, and supported mattes/filters.
- **`GET /api/discover` / `POST /api/discover`** — Scans the LAN via SSDP + concurrent port-8001 `/api/v2/` probe and returns all discovered Samsung The Frame TVs.
- **`POST /api/tv/select`** — Switches the active TV (`{"ip": "192.168.1.x"}`).
- **`GET /api/thumbnail/{content_id}`** — Returns the cached or D2D-fetched JPEG thumbnail (`image/jpeg`) for a TV artwork item.
- **`POST /api/upload`** — Multipart upload (`file`, `matte_id`, `portrait_matte_id`, `photo_filter`, `show_now`, optional `crop_x`, `crop_y`, `crop_w`, `crop_h`, `rotate`). Normalizes EXIF orientation, crops/resizes to `3840 × 2160` UHD (95% JPEG, 4:4:4 chroma), uploads via D2D TLS socket, and pre-populates the local thumbnail cache.
- **`POST /api/select`** — Displays an existing artwork immediately on the TV (`{"content_id": "MY_F0001", "show": true}`).
- **`POST /api/matte`** — Restyles an existing artwork's matte and photo filter in place (`{"content_id": "MY_F0001", "matte_id": "flexible_polar", "photo_filter": "None"}`).
- **`DELETE /api/art/{content_id}`** — Deletes an artwork from the TV's storage and removes its cached thumbnail.
- **`POST /api/artmode`** — Toggles Art Mode on or off (`{"status": "on" | "off"}`).
- **`POST /api/slideshow`** — Configures slideshow interval in minutes (`0` for off) and shuffle (`{"duration": 15, "shuffle": true}`).

---

## Protocol Notes (2024/2025 Tizen Frame TVs, Art API `5.0.1.0`)

1. **Discovery (`/api/v2/`)**: Tizen exposes unauthenticated device metadata at `http://<tv-ip>:8001/api/v2/` with `device.FrameTVSupport = "true"`, `device.modelName`, and `device.TokenAuthSupport`.
2. **Command Names**: Modern Frame firmware (`5.0.1.0`, e.g. `LS03D` / `LS03F`) uses `"request": "api_version"` rather than `"get_api_version"` (which is silently ignored).
3. **Nested `conn_info`**: In `get_thumbnail_list` and `send_image` (`ready_to_use`), `conn_info` is returned as a JSON-encoded **string** inside the D2D service message payload, and `conn_info["id"]` must match the outer `request_id` UUID.
4. **D2D Framing**: Binary transfers over the ephemeral D2D TLS socket are framed with a 4-byte big-endian header length (`!I`), followed by an ASCII JSON header (`num`, `total`, `fileLength`, `fileName`, `fileType`, `secKey`, `version`), followed by the raw JPEG bytes.
5. **OpenSSL 3 EOF Handling**: Tizen's ephemeral D2D TLS socket server closes the TCP stream immediately after sending thumbnail bytes without a TLS `close_notify` alert; Unframed enables `ssl.OP_IGNORE_UNEXPECTED_EOF` so Python 3.12+ / OpenSSL 3 reads complete cleanly.

---

## License

MIT
