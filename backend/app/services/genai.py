"""AI 'photoshoot' via Google Gemini image generation.

One run produces a full professional set — white packshot, styled background,
on-model, macro detail, and a dimension/scale shot — all keeping the exact
design. A shared faithfulness wrapper is prepended to every shot. Without
GEMINI_API_KEY it runs in STUB mode (faithful processed variants) so the review
workflow is testable; the moment a key is set, the same code calls Gemini.
"""
from __future__ import annotations

import base64
import logging

import httpx

from app.config import settings
from app.services import imaging

log = logging.getLogger("garg.genai")

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT = 90.0

# ---- Prompt building blocks ----
_PRESERVE = (
    "Professional product photography of the EXACT piece of jewellery shown in the "
    "attached photo(s) — a re-photographing of the SAME physical item, not a new "
    "design. Reproduce with 100% fidelity: identical shape, silhouette and "
    "proportions; the same number, cut, size, colour and placement of every "
    "zircon/stone; the same bright rhodium-white 925 sterling silver tone (never "
    "gold or yellow); the same engraving, filigree, prongs, setting, clasp and "
    "chain links. Do NOT add, remove, resize, recolour or rearrange any detail, or "
    "invent parts hidden in the reference. "
)
_CRAFT = (
    " Crisp macro-quality capture, ~100mm lens, tack-sharp across the piece, "
    "realistic metal reflections and gemstone sparkle, accurate white balance, "
    "soft-box lighting, high resolution, photorealistic."
)
_NEGATIVE = (
    " Avoid: changing the design, extra or different stones, gold or yellow tint, "
    "duplicated jewellery, props covering the piece, text, logos, watermarks, "
    "warping, distortion, blur."
)

# shot key -> (human label, scene line). Order defines the generated set.
SHOT_SET: dict[str, tuple[str, str]] = {
    "white": (
        "White packshot",
        "Scene: seamless pure-white (#FFFFFF) studio sweep, the piece centred with a "
        "soft natural contact shadow and a faint reflection beneath, bright even "
        "shadowless lighting, straight-on hero angle, clean e-commerce catalogue packshot.",
    ),
    "lifestyle": (
        "Styled background",
        "Scene: staged on polished marble or soft silk with a tasteful, softly "
        "out-of-focus warm cream background, warm window light, gentle highlights on "
        "the silver, premium boutique-catalogue styling; the piece is the clear focal point.",
    ),
    "on_model": (
        "On model",
        "Scene: worn by a model with natural realistic skin, anatomically-correct "
        "placement for this item type (earring on the ear, ring on a finger, necklace "
        "on the neckline, bangle on the wrist, nose pin on the nose), soft natural "
        "light, shallow depth of field with the jewellery tack-sharp and the hero; "
        "model and background softly blurred; elegant beauty shot.",
    ),
    "macro": (
        "Macro detail",
        "Scene: extreme macro close-up showing craftsmanship — silver texture, stone "
        "facets and sparkle, engraving and prong detail — soft dramatic lighting, very "
        "shallow depth of field, softly-graded dark background.",
    ),
    "dimension": (
        "Dimension",
        "Scene: clean white-background top-down flat-lay of the piece beside a neat "
        "ruler with faint millimetre gridlines, even lighting, technical size-reference "
        "catalogue look.",
    ),
}
LABELS = [label for label, _ in SHOT_SET.values()]


def build_prompt(scene: str, extra: str | None, feedback: str | None) -> str:
    prompt = _PRESERVE + scene + _CRAFT + _NEGATIVE
    if extra:
        prompt += f" {extra.strip()}"
    if feedback:
        prompt += (
            " REVIEWER CORRECTION (highest priority) — fix exactly this while keeping "
            f"the design identical: {feedback.strip()}"
        )
    return prompt


def _scene_for(label: str) -> str:
    for lbl, scene in SHOT_SET.values():
        if lbl == label:
            return scene
    return SHOT_SET["white"][1]


# ---- Public API ----
def generate_set(
    images: list[bytes], *, size_mm: float | None = None, extra: str | None = None
) -> list[tuple[str, bytes]]:
    """Generate the full photoshoot set: list of (label, jpeg_bytes)."""
    out: list[tuple[str, bytes]] = []
    stub_variants = None if settings.gemini_enabled else _stub_variants(images)
    for i, (key, (label, scene)) in enumerate(SHOT_SET.items()):
        if settings.gemini_enabled:
            img = _call_gemini(images, build_prompt(scene, extra, None))
        else:
            img = stub_variants[i % len(stub_variants)] if stub_variants else None
        if not img:
            continue
        if key == "dimension" and size_mm:
            img = imaging.annotate_dimension(img, float(size_mm))
        out.append((label, img))
    return out


def generate_one(
    images: list[bytes], label: str, feedback: str | None, size_mm: float | None = None
) -> bytes | None:
    """Regenerate a single shot type (used by the per-image regenerate)."""
    scene = _scene_for(label)
    if settings.gemini_enabled:
        img = _call_gemini(images, build_prompt(scene, None, feedback))
    else:
        variants = _stub_variants(images)
        img = variants[0] if variants else None
    if img and label == SHOT_SET["dimension"][0] and size_mm:
        img = imaging.annotate_dimension(img, float(size_mm))
    return img


def assess_references(images: list[bytes]) -> str | None:
    """Return a hint if more angles are needed, else None."""
    if not settings.gemini_enabled:
        return None if len(images) >= 2 else "Add one more photo from a different angle for a better result."
    prompt = (
        "You are helping photograph a piece of jewellery. From these reference "
        "photos, can the piece be recreated faithfully? Reply exactly 'OK' if yes, "
        "otherwise one short sentence naming the extra angle to photograph."
    )
    try:
        body = {"contents": [{"parts": [{"text": prompt}, *_parts(images)]}]}
        r = httpx.post(
            f"{API_ROOT}/{settings.gemini_text_model}:generateContent",
            params={"key": settings.gemini_api_key}, json=body, timeout=TIMEOUT,
        )
        r.raise_for_status()
        text = (_first_text(r.json()) or "").strip()
        return None if text.upper().startswith("OK") else (text or None)
    except Exception:
        log.exception("Gemini readiness check failed")
        return None


# ---- internals ----
def _parts(images: list[bytes]) -> list[dict]:
    return [
        {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(b).decode()}}
        for b in images
    ]


def _call_gemini(images: list[bytes], prompt: str) -> bytes | None:
    try:
        body = {
            "contents": [{"parts": [{"text": prompt}, *_parts(images)]}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
        }
        r = httpx.post(
            f"{API_ROOT}/{settings.gemini_image_model}:generateContent",
            params={"key": settings.gemini_api_key}, json=body, timeout=TIMEOUT,
        )
        r.raise_for_status()
        return _first_image(r.json()) or (_stub_variants(images)[0] if images else None)
    except Exception:
        log.exception("Gemini image generation failed")
        return _stub_variants(images)[0] if images else None


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


def _stub_variants(images: list[bytes]) -> list[bytes]:
    if not images:
        return []
    return [jpeg for _l, jpeg in imaging.generate_variants(images[0])] or [images[0]]
