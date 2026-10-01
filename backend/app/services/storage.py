"""Image storage abstraction.

Saves image bytes to Cloudinary when it's configured (so photos persist across
redeploys and are served from a CDN), otherwise to the local uploads/ folder
(fine for dev, or a VPS with a mounted volume). Callers just get back a URL.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from app.config import settings

log = logging.getLogger("garg.storage")

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

_cloudinary_ready = False
if settings.cloudinary_enabled:
    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    _cloudinary_ready = True


def save_bytes(data: bytes, ext: str = ".jpg") -> str:
    """Persist image bytes and return a public URL."""
    if _cloudinary_ready:
        import cloudinary.uploader

        res = cloudinary.uploader.upload(
            data,
            folder="garg-jewellers/products",
            resource_type="image",
        )
        return res["secure_url"]

    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(data)
    return f"{settings.public_base_url}/uploads/{filename}"


def delete(url: str) -> None:
    """Best-effort delete. Only removes files we clearly own."""
    if _cloudinary_ready and "res.cloudinary.com" in url or "cloudinary.com" in url:
        try:
            import cloudinary.uploader

            # public_id = folder path + filename without extension
            parts = url.split("/upload/")
            if len(parts) == 2:
                public_id = parts[1].split(".")[0]
                # strip a leading version segment like v123456/
                segs = public_id.split("/")
                if segs and segs[0].startswith("v") and segs[0][1:].isdigit():
                    segs = segs[1:]
                cloudinary.uploader.destroy("/".join(segs))
        except Exception:
            log.exception("Cloudinary delete failed")
        return

    if url.startswith(settings.public_base_url):
        name = url.rsplit("/", 1)[-1]
        target = UPLOAD_DIR / name
        if target.is_file():
            try:
                target.unlink()
            except OSError:
                pass
