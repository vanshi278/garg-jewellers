"""AI 'photoshoot' via Google Gemini image generation.

Takes a few reference photos of a piece + a scene prompt, and generates
professional product shots that keep the design. Also runs a lightweight
'readiness check' that can tell the owner another angle is needed.

Without GEMINI_API_KEY it runs in STUB mode: it returns faithful processed
variants of the references (via app.services.imaging) so the whole review
workflow is testable, and the readiness check returns a canned hint. The moment
a real key is set, the same functions call Gemini.
"""
from __future__ import annotations

import base64
import logging

import httpx

from app.config import settings
from app.services import imaging

log = logging.getLogger("garg.genai")

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT = 60.0

# Scene presets → the style half of the prompt. The design-preservation half is
# always prepended so the piece itself is never altered.
PRESETS: dict[str, str] = {
    "white_studio": "on a clean seamless pure-white studio background, soft even lighting, subtle reflection, e-commerce product photography",
    "dark_luxe": "on a dark charcoal background with a warm spotlight, luxury jewellery product photography, soft shadows",
    "on_model": "worn by a model with natural skin, tasteful and realistic placement, soft natural light, lifestyle product photography",
    "lifestyle": "in an elegant lifestyle setting with soft bokeh background, warm natural light, premium catalogue photography",
}

_PRESERVE = (
    "Reproduce THIS EXACT piece of 925 sterling silver jewellery with identical "
    "design, shape, stones, engraving and proportions — do not redesign, add or "
    "remove any detail. Keep the jewellery pixel-faithful to the reference photos. "
    "Only change the scene/background as described. Photorealistic, high resolution. "
)


def build_prompt(preset: str, extra: str | None, feedback: str | None) -> str:
    scene = PRESETS.get(preset, PRESETS["white_studio"])
    prompt = f"{_PRESERVE}Scene: {scene}."
    if extra:
        prompt += f" {extra.strip()}"
    if feedback:
        # Owner's correction from the review loop.
        prompt += f" IMPORTANT correction from the reviewer — fix this and keep the design exact: {feedback.strip()}"
    return prompt


def _parts_from_images(images: list[bytes]) -> list[dict]:
    return [
        {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(b).decode()}}
        for b in images
    ]


def assess_references(images: list[bytes]) -> str | None:
    """Return a hint if more angles are needed, else None (good to go)."""
    if not settings.gemini_enabled:
        return None if len(images) >= 2 else "Add at least one more photo from a different angle for a better result."

    prompt = (
        "You are helping photograph a piece of jewellery. Looking at these "
        "reference photos, are they enough to recreate the piece faithfully from "
        "the front? Reply with exactly 'OK' if yes. If not, reply with one short "
        "sentence telling the seller which additional angle to photograph."
    )
    try:
        body = {"contents": [{"parts": [{"text": prompt}, *_parts_from_images(images)]}]}
        r = httpx.post(
            f"{API_ROOT}/{settings.gemini_text_model}:generateContent",
            params={"key": settings.gemini_api_key},
            json=body,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        text = _first_text(r.json()) or ""
        return None if text.strip().upper().startswith("OK") else (text.strip() or None)
    except Exception:
        log.exception("Gemini readiness check failed")
        return None  # don't block generation on a failed check


def generate(images: list[bytes], prompt: str, count: int = 2) -> list[bytes]:
    """Generate `count` candidate images. Falls back to stub variants."""
    if not settings.gemini_enabled:
        return _stub(images, count)

    out: list[bytes] = []
    for _ in range(count):
        try:
            body = {
                "contents": [{"parts": [{"text": prompt}, *_parts_from_images(images)]}],
                "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
            }
            r = httpx.post(
                f"{API_ROOT}/{settings.gemini_image_model}:generateContent",
                params={"key": settings.gemini_api_key},
                json=body,
                timeout=TIMEOUT,
            )
            r.raise_for_status()
            img = _first_image(r.json())
            if img:
                out.append(img)
        except Exception:
            log.exception("Gemini image generation failed")
    # If the API produced nothing, fall back so the owner still sees candidates.
    return out or _stub(images, count)


# ---- helpers ----
def _first_text(payload: dict) -> str | None:
    for cand in payload.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            if "text" in part:
                return part["text"]
    return None


def _first_image(payload: dict) -> bytes | None:
    for cand in payload.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            data = part.get("inline_data", {}).get("data") or part.get("inlineData", {}).get("data")
            if data:
                return base64.b64decode(data)
    return None


def _stub(images: list[bytes], count: int) -> list[bytes]:
    """No-key fallback: faithful processed variants of the first reference."""
    if not images:
        return []
    variants = [jpeg for _label, jpeg in imaging.generate_variants(images[0])]
    return variants[:count] if variants else [images[0]]
