"""Product image processing.

Every owner upload is enhanced for consistent quality and framing, then
expanded into faithful variants — a zoom crop, and (when the AI background
remover is available) plain-white-bg and dark-bg cutouts. Every variant is a
transform of the *original pixels*, so the jewellery design is never altered.

Background removal uses rembg (U²-Net segmentation); if it isn't installed the
service degrades to enhance + zoom only, so uploads always succeed.
"""
from __future__ import annotations

import logging
from io import BytesIO

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

log = logging.getLogger("garg.imaging")

CANVAS = 1200  # all outputs are a consistent CANVAS×CANVAS square
WHITE = (255, 255, 255)
DARK = (28, 20, 14)
JPEG_Q = 88


def _load(data: bytes) -> Image.Image:
    img = Image.open(BytesIO(data))
    img = ImageOps.exif_transpose(img)  # honour phone orientation
    return img.convert("RGB")


def _enhance(img: Image.Image) -> Image.Image:
    """Consistent, non-destructive quality lift."""
    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Color(img).enhance(1.07)
    img = ImageEnhance.Sharpness(img).enhance(1.4)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    return img


def _fit(img: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    """Contain the image, centered, on a CANVAS×CANVAS background."""
    im = img.copy()
    im.thumbnail((CANVAS, CANVAS), Image.LANCZOS)
    canvas = Image.new("RGB", (CANVAS, CANVAS), bg)
    canvas.paste(im, ((CANVAS - im.width) // 2, (CANVAS - im.height) // 2))
    return canvas


def _fit_rgba(rgba: Image.Image) -> Image.Image:
    im = rgba.copy()
    im.thumbnail((CANVAS, CANVAS), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(im, ((CANVAS - im.width) // 2, (CANVAS - im.height) // 2))
    return canvas


def _zoom(img: Image.Image, factor: float = 1.6) -> Image.Image:
    w, h = img.size
    cw, ch = int(w / factor), int(h / factor)
    left, top = (w - cw) // 2, (h - ch) // 2
    crop = img.crop((left, top, left + cw, top + ch))
    return crop.resize((CANVAS, CANVAS), Image.LANCZOS)


def _cutout(img: Image.Image) -> Image.Image | None:
    """AI background removal → RGBA cutout, or None if disabled/unavailable."""
    from app.config import settings

    if not settings.enable_bg_removal:
        return None
    try:
        from rembg import remove  # heavy import; lazy
    except Exception:
        return None
    try:
        return remove(img).convert("RGBA")
    except Exception:
        log.exception("Background removal failed")
        return None


def _on_bg(rgba: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    base = Image.new("RGB", rgba.size, bg)
    base.paste(rgba, mask=rgba.split()[3])
    return base


def _jpeg(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.save(buf, "JPEG", quality=JPEG_Q, optimize=True)
    return buf.getvalue()


def annotate_dimension(data: bytes, mm: float) -> bytes:
    """Stamp the real measurement onto a dimension shot (AI can't know true mm,
    so we draw the accurate size from the owner's product data)."""
    img = Image.open(BytesIO(data)).convert("RGB")
    w, h = img.size
    draw = ImageDraw.Draw(img, "RGBA")
    label = f"{mm:g} mm".rstrip()

    # Measurement bar across the lower third.
    y = int(h * 0.86)
    x0, x1 = int(w * 0.18), int(w * 0.82)
    bar = max(2, w // 400)
    tick = max(6, h // 60)
    col = (40, 28, 20, 255)
    draw.line([(x0, y), (x1, y)], fill=col, width=bar)
    draw.line([(x0, y - tick), (x0, y + tick)], fill=col, width=bar)
    draw.line([(x1, y - tick), (x1, y + tick)], fill=col, width=bar)

    # Label on a soft white chip for legibility.
    size = max(18, w // 28)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", size)
    except Exception:
        font = ImageFont.load_default()
    tb = draw.textbbox((0, 0), label, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    cx = w // 2
    pad = size // 2
    draw.rounded_rectangle(
        [cx - tw // 2 - pad, y - tick - th - 2 * pad, cx + tw // 2 + pad, y - tick - pad // 2],
        radius=pad, fill=(255, 255, 255, 230),
    )
    draw.text((cx - tw // 2, y - tick - th - pad - pad // 2), label, fill=col, font=font)

    buf = BytesIO()
    img.save(buf, "JPEG", quality=JPEG_Q)
    return buf.getvalue()


def generate_variants(data: bytes) -> list[tuple[str, bytes]]:
    """Return a list of (label, jpeg_bytes). The first is the cover.

    Faithful set: enhanced main, zoom, and — when AI cutout works — white-bg
    and dark-bg. All share identical framing so the gallery stays consistent.
    """
    base = _enhance(_load(data))
    out: list[tuple[str, bytes]] = [
        ("main", _jpeg(_fit(base, WHITE))),
        ("zoom", _jpeg(_zoom(base))),
    ]

    cut = _cutout(base)
    if cut is not None:
        fitted = _fit_rgba(cut)
        out.append(("white", _jpeg(_on_bg(fitted, WHITE))))
        out.append(("dark", _jpeg(_on_bg(fitted, DARK))))
    else:
        log.info("rembg unavailable — background variants skipped")

    return out
