"""Unframed — Samsung The Frame Local Art Mode Client.

Provides a thread-safe, short-lived WebSocket and D2D TLS socket client
for interacting with Samsung The Frame TV's Art Mode API over LAN without
Samsung cloud apps or SmartThings.
"""

from __future__ import annotations

import base64
import contextlib
from datetime import datetime
import json
import logging
import os
import random
import socket
import ssl
import struct
import threading
import time
from typing import Any
import urllib.request
import uuid

logger = logging.getLogger("unframed.frame_tv")

FRAME_TV_IP = os.environ.get("FRAME_TV_IP", "").strip()
FRAME_TV_PORT = int(os.environ.get("FRAME_TV_PORT", "8002"))
FRAME_TV_WS_NAME = os.environ.get("FRAME_TV_WS_NAME", "Unframed").strip()
FRAME_TV_TOKEN = os.environ.get("FRAME_TV_TOKEN", "").strip()
FRAME_TV_MODEL = os.environ.get("FRAME_TV_MODEL", "").strip()
THUMB_CACHE_DIR = os.environ.get("THUMB_CACHE_DIR", "/tmp/unframed-thumbs")
FRAME_TV_TOKEN_FILE = os.environ.get(
    "FRAME_TV_TOKEN_FILE", os.path.join(THUMB_CACHE_DIR, ".tv_token")
)


def _encode_ws_name(name: str) -> str:
    """Return base64-encoded client name, preserving already-encoded values."""
    if not name:
        name = "Unframed"
    try:
        decoded = base64.b64decode(name, validate=True).decode("utf-8")
        if base64.b64encode(decoded.encode("utf-8")).decode("ascii") == name:
            return name
    except Exception:
        pass
    return base64.b64encode(name.encode("utf-8")).decode("ascii")


class FrameTVClient:
    """Thread-safe short-lived client for Samsung The Frame TV Art Mode."""

    MATTE_TYPES = [
        "none",
        "modernthin",
        "modern",
        "modernwide",
        "flexible",
        "shadowbox",
        "panoramic",
        "triptych",
        "mix",
        "squares",
    ]

    MATTE_COLORS = [
        "black",
        "neutral",
        "antique",
        "warm",
        "polar",
        "sand",
        "seafoam",
        "sage",
        "burgandy",
        "navy",
        "apricot",
        "byzantine",
        "lavender",
        "redorange",
        "skyblue",
        "turquoise",
    ]

    PHOTO_FILTERS = [
        "None",
        "Aqua",
        "ArtDeco",
        "Ink",
        "Wash",
        "Pastel",
        "Feuve",
    ]

    def __init__(
        self,
        host: str = FRAME_TV_IP,
        port: int = FRAME_TV_PORT,
        ws_name: str = FRAME_TV_WS_NAME,
        token: str = FRAME_TV_TOKEN,
        thumb_cache_dir: str = THUMB_CACHE_DIR,
        token_file: str = FRAME_TV_TOKEN_FILE,
        timeout: float = 15.0,
    ) -> None:
        self.host = host
        self.port = port
        self.ws_name = _encode_ws_name(ws_name)
        self.thumb_cache_dir = thumb_cache_dir
        self.token_file = token_file
        self.timeout = timeout
        self._lock = threading.Lock()
        self._discovered_model: str | None = FRAME_TV_MODEL or None
        os.makedirs(self.thumb_cache_dir, exist_ok=True)
        self.token = token or self._load_persisted_token()

    def _load_persisted_token(self) -> str:
        if self.token_file and os.path.isfile(self.token_file):
            try:
                with open(self.token_file, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except OSError:
                pass
        return ""

    def _save_persisted_token(self, token: str) -> None:
        if not token or not self.token_file:
            return
        try:
            parent = os.path.dirname(self.token_file)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(self.token_file, "w", encoding="utf-8") as f:
                f.write(token.strip())
        except OSError as exc:
            logger.warning("Could not persist TV token to %s: %s", self.token_file, exc)

    def get_model_name(self) -> str:
        """Return the TV model name (auto-discovered via :8001/api/v2/ or fallback)."""
        if self._discovered_model:
            return self._discovered_model
        if not self.host:
            return "The Frame"
        try:
            url = f"http://{self.host}:8001/api/v2/"
            with urllib.request.urlopen(url, timeout=2.5) as resp:
                info = json.loads(resp.read().decode("utf-8", errors="replace"))
                device = info.get("device") if isinstance(info, dict) else None
                model = (
                    (device.get("modelName") if isinstance(device, dict) else None)
                    or info.get("name")
                    or "The Frame"
                )
                self._discovered_model = str(model)
                return self._discovered_model
        except Exception:
            return "The Frame"

    # -------------------------------------------------------------------------
    # WebSocket & TLS Helpers (RFC 6455 Client)
    # -------------------------------------------------------------------------

    def _create_ssl_context(self) -> ssl.SSLContext:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        if hasattr(ssl, "OP_IGNORE_UNEXPECTED_EOF"):
            ctx.options |= ssl.OP_IGNORE_UNEXPECTED_EOF
        return ctx

    def _recv_exact(self, sock: socket.socket, num_bytes: int) -> bytes:
        buf = bytearray()
        while len(buf) < num_bytes:
            chunk = sock.recv(num_bytes - len(buf))
            if not chunk:
                raise ConnectionError("Socket closed prematurely while reading bytes")
            buf.extend(chunk)
        return bytes(buf)

    def _ws_send_frame(self, sock: socket.socket, opcode: int, payload: bytes) -> None:
        b1 = 0x80 | (opcode & 0x0F)
        length = len(payload)
        mask_key = os.urandom(4)

        if length <= 125:
            header = bytes([b1, 0x80 | length])
        elif length <= 65535:
            header = bytes([b1, 0x80 | 126]) + struct.pack("!H", length)
        else:
            header = bytes([b1, 0x80 | 127]) + struct.pack("!Q", length)

        masked_payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
        sock.sendall(header + mask_key + masked_payload)

    def _ws_send_text(self, sock: socket.socket, text: str) -> None:
        self._ws_send_frame(sock, 0x1, text.encode("utf-8"))

    def _ws_recv_frame(self, sock: socket.socket) -> tuple[int, bytes]:
        while True:
            b1, b2 = struct.unpack("!BB", self._recv_exact(sock, 2))
            opcode = b1 & 0x0F
            masked = bool(b2 & 0x80)
            length = b2 & 0x7F

            if length == 126:
                length = struct.unpack("!H", self._recv_exact(sock, 2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self._recv_exact(sock, 8))[0]

            if masked:
                mask_key = self._recv_exact(sock, 4)
                raw_payload = self._recv_exact(sock, length)
                payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(raw_payload))
            else:
                payload = self._recv_exact(sock, length)

            # RFC 6455 opcode handling
            if opcode == 0x8:  # Close
                try:
                    sock.close()
                except Exception:
                    pass
                raise ConnectionError("WebSocket received close opcode (0x8)")
            elif opcode == 0x9:  # Ping -> reply Pong (0xA) with same payload
                self._ws_send_frame(sock, 0xA, payload)
                continue
            elif opcode == 0xA:  # Pong
                continue
            elif opcode in (0x1, 0x2):  # Text or Binary
                return opcode, payload
            else:
                # Discard unknown opcodes and continue
                continue

    def _ws_open(self) -> socket.socket:
        if not self.host:
            raise RuntimeError(
                "FRAME_TV_IP is not configured. Set FRAME_TV_IP in your .env file."
            )
        ctx = self._create_ssl_context()
        raw_sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
        ws_sock = ctx.wrap_socket(raw_sock, server_hostname=self.host)

        sec_key = base64.b64encode(os.urandom(16)).decode("ascii")
        path = f"/api/v2/channels/com.samsung.art-app?name={self.ws_name}"
        if self.token:
            path += f"&token={self.token}"
        req = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {sec_key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        ws_sock.sendall(req.encode("ascii"))

        # Read HTTP handshake response byte-by-byte so we never consume WS frames
        header_buf = bytearray()
        while b"\r\n\r\n" not in header_buf:
            chunk = ws_sock.recv(1)
            if not chunk:
                raise ConnectionError("Failed to receive WebSocket handshake response")
            header_buf.extend(chunk)

        header_text = header_buf.decode("latin1", errors="replace")
        status_line = header_text.split("\r\n", 1)[0]
        if "101" not in status_line:
            ws_sock.close()
            raise ConnectionError(f"WebSocket upgrade rejected by TV: {status_line}")

        # Wait until channel is ready
        ready = False
        while not ready:
            opcode, payload = self._ws_recv_frame(ws_sock)
            if opcode != 0x1:
                continue
            try:
                msg = json.loads(payload.decode("utf-8"))
            except Exception:
                continue

            event = msg.get("event")
            if event == "ms.channel.connect":
                data = msg.get("data")
                if isinstance(data, dict) and "token" in data:
                    self.token = str(data["token"])
                    self._save_persisted_token(self.token)
            elif event == "ms.channel.ready":
                ready = True

        return ws_sock

    def _ws_close(self, ws: socket.socket) -> None:
        try:
            self._ws_send_frame(ws, 0x8, b"")
        except Exception:
            pass
        try:
            ws.close()
        except Exception:
            pass

    @contextlib.contextmanager
    def _connect(self):
        ws = self._ws_open()
        try:
            yield ws
        finally:
            self._ws_close(ws)

    # -------------------------------------------------------------------------
    # Art App Request Helper
    # -------------------------------------------------------------------------

    def _parse_conn_info(self, resp: dict[str, Any]) -> dict[str, Any]:
        conn_info = resp.get("conn_info")
        if not conn_info and isinstance(resp.get("data"), dict):
            conn_info = resp["data"].get("conn_info")
        if isinstance(conn_info, str):
            conn_info = json.loads(conn_info)
        if not isinstance(conn_info, dict):
            raise RuntimeError(f"No valid conn_info found in response: {resp}")
        return conn_info

    def _request(
        self,
        ws: socket.socket,
        request_name: str,
        wait_sub_event: str | None = None,
        request_uuid: str | None = None,
        **params: Any,
    ) -> dict[str, Any]:
        uid = request_uuid or str(uuid.uuid4())
        payload = {
            "request": request_name,
            "id": uid,
            "request_id": uid,
            **params,
        }
        msg = {
            "method": "ms.channel.emit",
            "params": {
                "event": "art_app_request",
                "to": "host",
                "data": json.dumps(payload),
            },
        }
        self._ws_send_text(ws, json.dumps(msg))

        while True:
            opcode, raw = self._ws_recv_frame(ws)
            if opcode != 0x1:
                continue
            try:
                frame = json.loads(raw.decode("utf-8"))
            except Exception:
                continue

            event = frame.get("event")
            if event == "d2d_service_message":
                data = frame.get("data")
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                    except Exception:
                        continue
                if not isinstance(data, dict):
                    continue

                if data.get("event") == "error":
                    raise RuntimeError(f"Samsung Frame Art API error: {data}")

                if wait_sub_event:
                    if data.get("sub_event") == wait_sub_event or data.get("event") == wait_sub_event:
                        return data
                    continue

                req_id_val = str(data.get("request_id", ""))
                if req_id_val == uid or uid in req_id_val or data.get("id") == uid:
                    return data
            elif wait_sub_event and (
                event == wait_sub_event or frame.get("sub_event") == wait_sub_event
            ):
                return frame

    # -------------------------------------------------------------------------
    # Public API Methods
    # -------------------------------------------------------------------------

    def get_status(self) -> dict[str, Any]:
        """Fetch current TV Art Mode status, artwork, and uploaded photo list."""
        with self._lock:
            with self._connect() as ws:
                api_ver = self._request(ws, "api_version")
                artmode_resp = self._request(ws, "get_artmode_status")
                current_artwork = self._request(ws, "get_current_artwork")
                slideshow = self._request(ws, "get_slideshow_status")
                content_resp = self._request(ws, "get_content_list")

        version = api_ver.get("version") or api_ver.get("api_version") or "5.0.1.0"
        artmode = artmode_resp.get("value") or artmode_resp.get("status") or "unknown"

        raw_list = (
            content_resp.get("content_list")
            or content_resp.get("items")
            or content_resp.get("list")
            or []
        )
        if isinstance(raw_list, str):
            try:
                raw_list = json.loads(raw_list)
            except Exception:
                raw_list = []

        seen_ids: set[str] = set()
        my_photos = []
        for item in raw_list:
            if not isinstance(item, dict):
                continue
            cid = str(item.get("content_id", ""))
            if not cid or cid in seen_ids:
                continue
            if item.get("category_id") == "MY-C0002" or cid.startswith("MY_"):
                seen_ids.add(cid)
                my_photos.append({**item, "category_id": "MY-C0002"})

        return {
            "online": True,
            "tv_ip": self.host,
            "model": self.get_model_name(),
            "api_version": version,
            "artmode": artmode,
            "current_artwork": current_artwork,
            "slideshow": slideshow,
            "my_photos": my_photos,
            "matte_types": self.MATTE_TYPES,
            "matte_colors": self.MATTE_COLORS,
            "photo_filters": self.PHOTO_FILTERS,
        }

    def get_thumbnail(self, content_id: str) -> bytes:
        """Fetch thumbnail JPEG bytes, cached to disk under THUMB_CACHE_DIR."""
        cache_path = os.path.join(self.thumb_cache_dir, f"{content_id}.jpg")
        if os.path.isfile(cache_path):
            with open(cache_path, "rb") as f:
                return f.read()

        with self._lock:
            # Recheck cache after acquiring lock
            if os.path.isfile(cache_path):
                with open(cache_path, "rb") as f:
                    return f.read()

            last_err: Exception | None = None
            for attempt in range(3):
                try:
                    if attempt > 0:
                        time.sleep(0.3 * attempt)
                    with self._connect() as ws:
                        uid = str(uuid.uuid4())
                        conn_id = random.randrange(4 * 1024**3)
                        resp = self._request(
                            ws,
                            "get_thumbnail_list",
                            request_uuid=uid,
                            content_id_list=[{"content_id": content_id}],
                            conn_info={
                                "d2d_mode": "socket",
                                "connection_id": conn_id,
                                "id": uid,
                            },
                        )

                        conn_info = self._parse_conn_info(resp)

                        d2d_ip = conn_info.get("ip", self.host)
                        d2d_port = int(conn_info["port"])
                        secured = conn_info.get("secured", True)

                        sock = socket.create_connection((d2d_ip, d2d_port), timeout=self.timeout)
                        if secured:
                            ctx = self._create_ssl_context()
                            d2d_sock = ctx.wrap_socket(sock, server_hostname=d2d_ip)
                        else:
                            d2d_sock = sock

                        try:
                            hdr_len_bytes = self._recv_exact(d2d_sock, 4)
                            hdr_len = struct.unpack("!I", hdr_len_bytes)[0]
                            hdr_raw = self._recv_exact(d2d_sock, hdr_len)
                            hdr = json.loads(hdr_raw.decode("utf-8", errors="replace"))
                            file_length = int(hdr.get("fileLength", 0))
                            img_bytes = self._recv_exact(d2d_sock, file_length)
                        finally:
                            try:
                                d2d_sock.close()
                            except Exception:
                                pass

                        os.makedirs(self.thumb_cache_dir, exist_ok=True)
                        with open(cache_path, "wb") as f:
                            f.write(img_bytes)

                        time.sleep(0.1)
                        return img_bytes
                except Exception as exc:
                    last_err = exc
                    logger.warning(
                        "Attempt %d to fetch thumbnail %s failed: %s",
                        attempt + 1,
                        content_id,
                        exc,
                    )
            assert last_err is not None
            raise last_err

    def upload_image(
        self,
        img_bytes: bytes,
        file_type: str = "jpg",
        matte_id: str = "flexible_polar",
        portrait_matte_id: str | None = None,
        photo_filter: str | None = None,
        show_now: bool = True,
    ) -> dict[str, Any]:
        """Upload image to The Frame via D2D TLS socket and optionally display."""
        with self._lock:
            with self._connect() as ws:
                uid = str(uuid.uuid4())
                conn_id = random.randrange(4 * 1024**3)
                chosen_matte = matte_id or "none"
                chosen_portrait_matte = portrait_matte_id or chosen_matte

                resp = self._request(
                    ws,
                    "send_image",
                    wait_sub_event="ready_to_use",
                    request_uuid=uid,
                    file_type="jpg",
                    file_size=len(img_bytes),
                    image_date=datetime.now().strftime("%Y:%m:%d %H:%M:%S"),
                    matte_id=chosen_matte,
                    portrait_matte_id=chosen_portrait_matte,
                    conn_info={
                        "d2d_mode": "socket",
                        "connection_id": conn_id,
                        "id": uid,
                    },
                )

                conn_info = self._parse_conn_info(resp)

                d2d_ip = conn_info.get("ip", self.host)
                d2d_port = int(conn_info["port"])
                secured = conn_info.get("secured", True)

                header = json.dumps({
                    "num": 0,
                    "total": 1,
                    "fileLength": len(img_bytes),
                    "fileName": "image",
                    "fileType": file_type,
                    "secKey": conn_info["key"],
                    "version": "0.0.1",
                }).encode("ascii")

                payload_to_send = len(header).to_bytes(4, "big") + header + img_bytes

                sock = socket.create_connection((d2d_ip, d2d_port), timeout=self.timeout)
                if secured:
                    ctx = self._create_ssl_context()
                    d2d_sock = ctx.wrap_socket(sock, server_hostname=d2d_ip)
                else:
                    d2d_sock = sock

                try:
                    d2d_sock.sendall(payload_to_send)
                finally:
                    try:
                        d2d_sock.close()
                    except Exception:
                        pass

                # Loop on ws until event == "image_added"
                content_id = None
                while True:
                    opcode, raw = self._ws_recv_frame(ws)
                    if opcode != 0x1:
                        continue
                    try:
                        frame = json.loads(raw.decode("utf-8"))
                    except Exception:
                        continue

                    event = frame.get("event")
                    data = frame.get("data")
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except Exception:
                            pass

                    sub_ev = (
                        (isinstance(data, dict) and (data.get("sub_event") or data.get("event")))
                        or frame.get("sub_event")
                        or event
                    )

                    if sub_ev == "image_added":
                        if isinstance(data, dict):
                            content_id = data.get("content_id") or data.get("id") or data.get("image_id")
                        if not content_id:
                            content_id = frame.get("content_id") or frame.get("id")
                        break
                    elif sub_ev == "error":
                        raise RuntimeError(f"TV rejected image upload: {data or frame}")

                if not content_id:
                    raise RuntimeError("Image upload succeeded but content_id was not returned")

                if photo_filter and photo_filter.strip().lower() != "none":
                    try:
                        self._request(ws, "set_photo_filter", content_id=content_id, filter_id=photo_filter.strip())
                    except Exception as e:
                        logger.warning("Failed to apply photo filter %s: %s", photo_filter, e)

                if show_now:
                    self._request(ws, "select_image", content_id=content_id, category_id="MY-C0002", show=True)

        return {
            "ok": True,
            "content_id": content_id,
            "matte_id": chosen_matte,
            "shown": show_now,
        }

    def select_image(self, content_id: str, show: bool = True) -> dict[str, Any]:
        """Display artwork on TV."""
        with self._lock:
            with self._connect() as ws:
                self._request(
                    ws,
                    "select_image",
                    content_id=content_id,
                    category_id="MY-C0002",
                    show=show,
                )
        return {"ok": True, "content_id": content_id, "shown": show}

    def change_matte(
        self,
        content_id: str,
        matte_id: str,
        portrait_matte_id: str | None = None,
        photo_filter: str | None = None,
    ) -> dict[str, Any]:
        """Change matte type/color and optionally apply a photo filter."""
        chosen_matte = matte_id or "none"
        chosen_portrait = portrait_matte_id or chosen_matte
        with self._lock:
            with self._connect() as ws:
                self._request(
                    ws,
                    "change_matte",
                    content_id=content_id,
                    matte_id=chosen_matte,
                    portrait_matte_id=chosen_portrait,
                )
                if photo_filter and photo_filter.strip().lower() != "none":
                    self._request(
                        ws,
                        "set_photo_filter",
                        content_id=content_id,
                        filter_id=photo_filter.strip(),
                    )
        return {
            "ok": True,
            "content_id": content_id,
            "matte_id": chosen_matte,
            "photo_filter": photo_filter,
        }

    def delete_image(self, content_id: str) -> dict[str, Any]:
        """Delete image from TV and remove local cached thumbnail."""
        with self._lock:
            with self._connect() as ws:
                try:
                    self._request(
                        ws,
                        "delete_image_list",
                        content_id_list=[{"content_id": content_id}],
                    )
                except Exception:
                    self._request(ws, "delete_image", content_id=content_id)

        cache_path = os.path.join(self.thumb_cache_dir, f"{content_id}.jpg")
        if os.path.isfile(cache_path):
            try:
                os.remove(cache_path)
            except OSError:
                pass

        return {"ok": True, "content_id": content_id}

    def set_artmode(self, status: str) -> dict[str, Any]:
        """Turn Art Mode on or off ('on' or 'off')."""
        normalized = "on" if status.strip().lower() in ("on", "true", "1") else "off"
        with self._lock:
            with self._connect() as ws:
                self._request(ws, "set_artmode_status", value=normalized)
        return {"ok": True, "artmode": normalized}

    def set_slideshow(
        self,
        duration: int,
        shuffle: bool = True,
        category_id: str = "MY-C0002",
    ) -> dict[str, Any]:
        """Configure Art Mode slideshow playback."""
        value = "off" if duration <= 0 else str(duration)
        slideshow_type = "shuffleslideshow" if shuffle else "slideshow"
        with self._lock:
            with self._connect() as ws:
                self._request(
                    ws,
                    "set_slideshow_status",
                    value=value,
                    category_id=category_id,
                    type=slideshow_type,
                )
        return {
            "ok": True,
            "duration": duration,
            "shuffle": shuffle,
            "category_id": category_id,
        }
