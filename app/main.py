"""FastAPI application and Pillow image processing pipeline for Samsung The Frame."""

from __future__ import annotations

import io
import logging
import os
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

from frame_tv import FrameTVClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("unframed")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="Unframed", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (check_dir=False so startup succeeds while frontend compiles)
app.mount("/static", StaticFiles(directory=STATIC_DIR, check_dir=False), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

tv = FrameTVClient()


# -----------------------------------------------------------------------------
# Request Schemas
# -----------------------------------------------------------------------------

class SelectRequest(BaseModel):
    content_id: str
    show: bool = True


class MatteRequest(BaseModel):
    content_id: str
    matte_id: str
    portrait_matte_id: str | None = None
    photo_filter: str | None = None


class ArtmodeRequest(BaseModel):
    status: str


class SlideshowRequest(BaseModel):
    duration: int
    shuffle: bool = True
    category_id: str = "MY-C0002"


class SelectTVRequest(BaseModel):
    ip: str


# -----------------------------------------------------------------------------
# Web & Health Endpoints
# -----------------------------------------------------------------------------

@app.get("/healthz")
async def healthz() -> dict[str, bool]:
    """Basic healthcheck endpoint."""
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> Response:
    """Serve the single-page art management application."""
    index_file = os.path.join(TEMPLATES_DIR, "index.html")
    if os.path.isfile(index_file):
        return templates.TemplateResponse(request, "index.html")
    return HTMLResponse(
        "<!DOCTYPE html><html><head><title>Unframed</title></head>"
        "<body style='font-family:sans-serif;padding:2rem;text-align:center;'>"
        "<h1>Unframed</h1><p>Frontend assets are building...</p></body></html>"
    )


# -----------------------------------------------------------------------------
# TV Status & Media Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/status")
def get_status() -> dict[str, Any]:
    """Retrieve live status from Samsung The Frame TV."""
    try:
        return tv.get_status()
    except Exception as exc:
        logger.warning("Could not reach Frame TV at %s:%d: %s", tv.host, tv.port, exc)
        return {
            "online": False,
            "error": str(exc),
            "tv_ip": tv.host,
            "model": tv.get_model_name(),
            "api_version": None,
            "artmode": "unknown",
            "current_artwork": None,
            "slideshow": None,
            "my_photos": [],
            "discovered_tvs": tv.discovered_tvs,
            "matte_types": tv.MATTE_TYPES,
            "matte_colors": tv.MATTE_COLORS,
            "photo_filters": tv.PHOTO_FILTERS,
        }


@app.get("/api/discover")
@app.post("/api/discover")
def discover_tvs(request: Request) -> dict[str, Any]:
    """Auto-detect Samsung The Frame TVs on the LAN via SSDP and port-8001 scan."""
    extra_prefixes: list[str] = []
    xff = request.headers.get("x-forwarded-for", "")
    for candidate in [xff.split(",")[0].strip(), request.client.host if request.client else ""]:
        if candidate and candidate.startswith(("192.168.", "10.")):
            extra_prefixes.append(candidate)
    tvs = tv.discover_frame_tvs(extra_prefixes=extra_prefixes)
    return {
        "ok": True,
        "selected_ip": tv.host,
        "model": tv.get_model_name(),
        "tvs": tvs,
    }


@app.post("/api/tv/select")
def select_tv_endpoint(payload: SelectTVRequest) -> dict[str, Any]:
    """Switch active Frame TV to the specified LAN IP address."""
    try:
        return tv.select_tv(payload.ip)
    except Exception as exc:
        logger.error("Select TV failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/thumbnail/{content_id}")
def get_thumbnail(content_id: str) -> Response:
    """Retrieve thumbnail JPEG image for a given content item."""
    try:
        jpeg_bytes = tv.get_thumbnail(content_id)
        return Response(
            content=jpeg_bytes,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except Exception as exc:
        logger.error("Failed to fetch thumbnail for %s: %s", content_id, exc)
        raise HTTPException(status_code=404, detail=f"Thumbnail unavailable: {exc}")


# -----------------------------------------------------------------------------
# Artwork Upload Pipeline
# -----------------------------------------------------------------------------

@app.post("/api/upload")
async def upload_artwork(
    file: UploadFile = File(...),
    matte_id: str = Form("flexible_polar"),
    portrait_matte_id: str = Form(""),
    photo_filter: str = Form("None"),
    show_now: bool = Form(True),
    crop_x: float | None = Form(None),
    crop_y: float | None = Form(None),
    crop_w: float | None = Form(None),
    crop_h: float | None = Form(None),
    rotate: int = Form(0),
) -> dict[str, Any]:
    """Process uploaded photo (orientation, crop, resize) and upload to TV."""
    try:
        raw_bytes = await file.read()
        im = Image.open(io.BytesIO(raw_bytes))
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")

        # Handle user-requested rotation
        if rotate in (90, -270):
            im = im.transpose(Image.Transpose.ROTATE_270)
        elif rotate in (180, -180):
            im = im.transpose(Image.Transpose.ROTATE_180)
        elif rotate in (270, -90):
            im = im.transpose(Image.Transpose.ROTATE_90)

        width, height = im.size

        # Apply custom crop or center crop to 16:9
        if crop_w is not None and crop_h is not None and crop_w > 0 and crop_h > 0:
            x0 = max(0.0, crop_x or 0.0)
            y0 = max(0.0, crop_y or 0.0)
            x1 = min(float(width), x0 + crop_w)
            y1 = min(float(height), y0 + crop_h)
            im = im.crop((int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))))
        else:
            current_ratio = width / height
            target_ratio = 16.0 / 9.0
            if abs(current_ratio - target_ratio) > 0.01:
                if current_ratio > target_ratio:
                    new_w = int(round(height * target_ratio))
                    left = (width - new_w) // 2
                    im = im.crop((left, 0, left + new_w, height))
                else:
                    new_h = int(round(width / target_ratio))
                    top = (height - new_h) // 2
                    im = im.crop((0, top, width, top + new_h))

        # Scale to native 4K UHD display resolution (3840x2160)
        if im.size != (3840, 2160):
            im = im.resize((3840, 2160), Image.Resampling.LANCZOS)

        # Encode high quality JPEG
        out_buf = io.BytesIO()
        im.save(out_buf, format="JPEG", quality=95, subsampling=0, optimize=True)
        jpeg_payload = out_buf.getvalue()

        # Send to The Frame TV
        result = tv.upload_image(
            img_bytes=jpeg_payload,
            file_type="jpg",
            matte_id=matte_id,
            portrait_matte_id=portrait_matte_id or None,
            photo_filter=photo_filter if photo_filter and photo_filter.strip().lower() != "none" else None,
            show_now=show_now,
        )

        # Pre-populate thumbnail cache (384x216) so gallery displays immediately
        content_id = result.get("content_id")
        if content_id:
            try:
                thumb = im.resize((384, 216), Image.Resampling.LANCZOS)
                os.makedirs(tv.thumb_cache_dir, exist_ok=True)
                thumb_dest = os.path.join(tv.thumb_cache_dir, f"{content_id}.jpg")
                thumb.save(thumb_dest, format="JPEG", quality=85, optimize=True)
            except Exception as cache_err:
                logger.warning("Could not pre-populate thumbnail for %s: %s", content_id, cache_err)

        return result
    except Exception as exc:
        logger.error("Upload failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# -----------------------------------------------------------------------------
# Artwork & Art Mode Control Endpoints
# -----------------------------------------------------------------------------

@app.post("/api/select")
def select_artwork(payload: SelectRequest) -> dict[str, Any]:
    """Select artwork to display on screen."""
    try:
        return tv.select_image(content_id=payload.content_id, show=payload.show)
    except Exception as exc:
        logger.error("Select artwork failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/matte")
def update_matte(payload: MatteRequest) -> dict[str, Any]:
    """Update matte style, color, and optional photo filter on an artwork."""
    try:
        return tv.change_matte(
            content_id=payload.content_id,
            matte_id=payload.matte_id,
            portrait_matte_id=payload.portrait_matte_id,
            photo_filter=payload.photo_filter,
        )
    except Exception as exc:
        logger.error("Update matte failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/api/art/{content_id}")
def delete_artwork(content_id: str) -> dict[str, Any]:
    """Delete uploaded artwork from The Frame TV."""
    try:
        return tv.delete_image(content_id=content_id)
    except Exception as exc:
        logger.error("Delete artwork failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/artmode")
def set_artmode(payload: ArtmodeRequest) -> dict[str, Any]:
    """Toggle Art Mode on or off."""
    try:
        return tv.set_artmode(status=payload.status)
    except Exception as exc:
        logger.error("Set artmode failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/slideshow")
def set_slideshow(payload: SlideshowRequest) -> dict[str, Any]:
    """Configure Art Mode slideshow parameters."""
    try:
        return tv.set_slideshow(
            duration=payload.duration,
            shuffle=payload.shuffle,
            category_id=payload.category_id,
        )
    except Exception as exc:
        logger.error("Set slideshow failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
