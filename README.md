# Unframed

**Local 4K Art Mode studio and gallery for Samsung The Frame TVs — zero cloud, zero SmartThings, zero telemetry.**

Samsung's official way to upload your own photos to The Frame requires signing into a Samsung account, installing the SmartThings mobile app, and letting the TV phone home to Samsung's cloud servers. If you firewall your TV from the internet to block ACR/telemetry, the mobile app stops working.

**Unframed** talks directly to your TV over your local network using Samsung's on-device `com.samsung.art-app` WebSocket channel (`:8002`) and ephemeral Device-to-Device (D2D) TLS sockets. Drop any photo into the browser studio, pan/zoom/crop to 16:9 `3840 × 2160` UHD, preview mattes in real time, and push straight to the wall.

---

## Features

- **100% Local LAN Protocol (Art API 4.x / 5.x)**
  - Short-lived, thread-safe TLS WebSocket sessions (`wss://<FRAME_TV_IP>:8002/api/v2/channels/com.samsung.art-app`) opened only on demand so the TV never suffers from persistent socket lockups.
  - Direct D2D TLS binary socket transfers for instant 4K image uploads (`send_image`) and thumbnail downloads (`get_thumbnail_list`).
  - Automatic first-run token pairing and persistence — or bring an existing token from Home Assistant.
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

## Quickstart (Docker Compose)

1. **Clone the repository and create your `.env` file:**

   ```bash
   git clone https://github.com/<your-username>/unframed.git
   cd unframed
   cp .env.example .env
   ```

2. **Edit `.env` with your TV's local IP address:**

   ```ini
   FRAME_TV_IP=192.168.1.100
   FRAME_TV_PORT=8002
   FRAME_TV_WS_NAME=Unframed
   FRAME_TV_TOKEN=
   PORT=8094
   ```

3. **Start the container:**

   ```bash
   docker compose up -d --build
   ```

4. **Open `http://localhost:8094`**
   - **First-time pairing**: If `FRAME_TV_TOKEN` is blank, your TV will display an *"Allow Unframed to connect?"* prompt on screen during the first connection. Click **Allow** on your TV remote — Unframed will automatically save the issued token to its persistent volume so you never have to pair again.
   - **Reusing an existing Home Assistant token**: If your TV is already paired with Home Assistant's Samsung Smart TV integration, you can copy `token` and the base64-encoded client name into `FRAME_TV_TOKEN` and `FRAME_TV_WS_NAME` to skip the TV prompt entirely.

---

## Running Locally (Without Docker)

Requires Python 3.12+ and [`uv`](https://docs.astral.sh/uv/):

```bash
export FRAME_TV_IP=192.168.1.100
cd app
uv run --with-requirements pyproject.toml uvicorn main:app --host 127.0.0.1 --port 8094
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FRAME_TV_IP` | *(required)* | Local LAN IP address of your Samsung The Frame TV |
| `FRAME_TV_PORT` | `8002` | TLS WebSocket port on the TV (`8002` for TLS) |
| `FRAME_TV_WS_NAME` | `Unframed` | Client name (plain text or base64-encoded) sent during WebSocket handshake |
| `FRAME_TV_TOKEN` | *(auto-saved)* | 8-digit pairing token; if omitted, persisted automatically to `FRAME_TV_TOKEN_FILE` on first TV approval |
| `FRAME_TV_MODEL` | *(auto-discovered)* | Optional override for the TV model badge (otherwise queried from `http://<FRAME_TV_IP>:8001/api/v2/`) |
| `THUMB_CACHE_DIR` | `/tmp/unframed-thumbs` | Directory for cached TV gallery thumbnails and persisted pairing token |
| `PORT` | `8094` | Host port mapped by `docker-compose.yml` |

---

## Protocol Notes (2024/2025 Tizen Frame TVs, Art API `5.0.1.0`)

- **Command names**: Modern Frame firmware (`5.0.1.0`, e.g. `LS03D` / `LS03F`) uses `"request": "api_version"` rather than `"get_api_version"`.
- **Nested `conn_info`**: In `get_thumbnail_list` and `send_image` (`ready_to_use`), `conn_info` is returned as a JSON-encoded string inside the D2D service message payload, and `conn_info["id"]` must match the outer `request_id` UUID.
- **OpenSSL 3 EOF handling**: Tizen's ephemeral D2D TLS socket server closes the TCP stream immediately after sending thumbnail bytes without a TLS `close_notify` alert; Unframed enables `ssl.OP_IGNORE_UNEXPECTED_EOF` so Python 3.12+ / OpenSSL 3 reads complete cleanly.

---

## License

MIT
