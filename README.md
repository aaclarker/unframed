<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="Unframed — Local 4K Art Mode studio and gallery for Samsung The Frame TVs over LAN with zero cloud or SmartThings dependency">
</p>

<p align="center">
  <img src="./assets/readme/showcase.png" width="100%" alt="Unframed Studio UI showing the interactive 3840x2160 16:9 cropper, realistic beveled Polar matte simulator, 16 official Samsung matte color swatches, and the live My Collection TV gallery">
</p>

**Unframed** is a local 4K Art Mode studio for Samsung The Frame TVs. If you firewall your TV from the internet to block ACR/telemetry, Samsung's SmartThings app stops working. Unframed auto-detects your TV on the LAN and pushes `3840 × 2160` UHD photos, mattes, and filters directly over local Wi-Fi — no Samsung account, no mobile app, no cloud.

---

## Features

- **Zero-config LAN discovery** — finds Frame TVs in ~1.5s via SSDP + a `/24` port-8001 scan (`FrameTVSupport == "true"`), even inside a bridge-networked Docker container.
- **Interactive 4K UHD cropper (`3840 × 2160`)** — drag-and-drop JPEG/PNG/WebP, pan, zoom (`1×`–`4×`), rotate, Rule-of-Thirds grid, and 95% 4:4:4 JPEG export.
- **Live matte & filter simulator** — preview all **7 matte styles**, **16 Samsung matte colors**, and **7 photo filters** with beveled mat geometry before pushing.
- **On-device gallery (`MY-C0002`)** — browse cached TV thumbnails, switch active art, restyle mattes in place without re-uploading, and toggle Art Mode or slideshows.

---

## How It Works

<p align="center">
  <img src="./assets/readme/protocol.svg" width="100%" alt="Three-stage local LAN protocol: 1. SSDP and port 8001 /api/v2/ auto-discovery, 2. Short-lived TLS WebSocket on port 8002 to com.samsung.art-app, 3. Ephemeral D2D TLS binary socket for 4K JPEG upload and thumbnail transfer">
</p>

1. **Auto-Discovery (`:8001/api/v2/`)** — Verifies `FrameTVSupport == "true"` on the local subnet and self-heals if the TV's DHCP lease changes.
2. **Art Channel (`wss://<tv>:8002`)** — Short-lived TLS WebSocket to `com.samsung.art-app` opened on demand; saves the pairing token to `/data/.tv_token` on first approval.
3. **D2D Binary Stream (`:<ephemeral>`)** — Streams `[4B header len][JSON secKey][4K JPEG]` over a one-shot TLS socket and caches a `384 × 216` thumbnail locally.

---

## Quickstart

```bash
git clone https://github.com/aaclarker/unframed.git
cd unframed
docker compose up -d --build
```

Open **`http://localhost:8094`** with your TV on (or in Art Mode). Click **Allow** on the TV remote once when prompted — Unframed saves the token and discovered IP automatically.

<details>
<summary><strong>Local Python (<code>uv</code>) &amp; Optional <code>.env</code> Settings</strong></summary>

```bash
cd app
uv run --with-requirements pyproject.toml uvicorn main:app --host 127.0.0.1 --port 8094
```

All environment variables are optional (see [`.env.example`](.env.example)):

| Variable | Default | Purpose |
|---|---|---|
| `FRAME_TV_IP` | *(auto-detected)* | Pin a static TV IP (e.g. across routed VLANs) |
| `FRAME_TV_SUBNET` | *(auto-detected)* | `/24` subnet hint for LAN discovery (`192.168.1.0/24`) |
| `FRAME_TV_TOKEN` | *(auto-saved)* | Pre-seed an 8-digit pairing token (e.g. from Home Assistant) |
| `FRAME_TV_WS_NAME` | `Unframed` | Client name shown on the TV pairing prompt |
| `PORT` | `8094` | Host port mapped by `docker-compose.yml` |

</details>

<details>
<summary><strong>REST API &amp; Tizen Art API 5.0.1.0 Notes</strong></summary>

**Endpoints:** `GET /api/status` · `POST /api/discover` · `POST /api/tv/select` · `GET /api/thumbnail/{id}` · `POST /api/upload` · `POST /api/select` · `POST /api/matte` · `DELETE /api/art/{id}` · `POST /api/artmode` · `POST /api/slideshow`

- **2024/2025 Tizen (`Art API 5.0.1.0`)**: Uses `"request": "api_version"` (ignores `"get_api_version"`), returns `conn_info` as a nested JSON string whose `id` must match `request_id`, and requires `ssl.OP_IGNORE_UNEXPECTED_EOF` on D2D TLS reads.
- **Router firewall tip**: Drop the TV's outbound WAN traffic on `LAN_IN` rather than L2-blocking the client so DHCP and local subnet access keep working.

</details>

---

## License

[MIT](LICENSE)
