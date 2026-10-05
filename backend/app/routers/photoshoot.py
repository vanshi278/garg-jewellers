"""Owner AI photoshoot: generate professional product shots from a few
references, with a review loop (approve / reject-with-comment / regenerate /
add more angles). Owner-gated.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_owner
from app.database import get_db
from app.models.catalogue import Product
from app.models.photoshoot import GenerationCandidate, GenerationJob
from app.schemas.photoshoot import JobOut, RegenerateRequest, RejectRequest
from app.services import genai, storage

router = APIRouter(
    prefix="/api/admin",
    tags=["admin-photoshoot"],
    dependencies=[Depends(require_owner)],
)

ALLOWED = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 6 * 1024 * 1024
MAX_REFS = 4


def _load_job(db: Session, job_id: int) -> GenerationJob | None:
    return db.scalar(
        select(GenerationJob)
        .where(GenerationJob.id == job_id)
        .options(selectinload(GenerationJob.candidates))
    )


async def _read_refs(files: list[UploadFile]) -> list[bytes]:
    refs: list[bytes] = []
    for f in files[:MAX_REFS]:
        if (f.content_type or "") not in ALLOWED:
            raise HTTPException(status_code=415, detail="Only JP, PNG or WebP images")
        data = await f.read()
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Each image must be under 6 MB")
        refs.append(data)
    if not refs:
        raise HTTPException(status_code=400, detail="Upload at least one reference photo")
    return refs


def _generate_set_into(
    job: GenerationJob, ref_bytes: list[bytes], size_mm, db: Session
) -> None:
    """Generate the full photoshoot set and store each labelled shot."""
    shots = genai.generate_set(ref_bytes, size_mm=size_mm, extra=job.extra_prompt)
    for label, img in shots:
        url = storage.save_bytes(img, ".jpg")
        db.add(GenerationCandidate(job_id=job.id, label=label, url=url))


@router.post("/products/{product_id}/photoshoot", response_model=JobOut, status_code=201)
async def start_photoshoot(
    product_id: int,
    files: list[UploadFile] = File(...),
    extra_prompt: str | None = Form(None),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    ref_bytes = await _read_refs(files)
    ref_urls = [storage.save_bytes(b, ".jpg") for b in ref_bytes]

    job = GenerationJob(
        product_id=product_id,
        extra_prompt=extra_prompt,
        reference_urls=ref_urls,
        readiness_hint=genai.assess_references(ref_bytes),
    )
    db.add(job)
    db.flush()
    _generate_set_into(job, ref_bytes, product.tryon_size_mm, db)
    db.commit()
    return _load_job(db, job.id)


@router.post("/photoshoot/{job_id}/add-references", response_model=JobOut)
async def add_references(
    job_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """Owner adds more angles (per the AI's hint), then we regenerate the set."""
    job = _load_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    more = await _read_refs(files)
    job.reference_urls = [*job.reference_urls, *[storage.save_bytes(b, ".jpg") for b in more]]
    job.readiness_hint = None
    product = db.get(Product, job.product_id)
    _generate_set_into(job, _fetch_refs(job), product.tryon_size_mm if product else None, db)
    db.commit()
    return _load_job(db, job.id)


@router.post("/photoshoot/candidates/{cid}/regenerate", response_model=JobOut)
def regenerate_candidate(cid: int, body: RegenerateRequest, db: Session = Depends(get_db)):
    """Regenerate ONE shot (same type) with the reviewer's correction."""
    cand = db.get(GenerationCandidate, cid)
    if cand is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    job = _load_job(db, cand.job_id)
    product = db.get(Product, job.product_id)
    img = genai.generate_one(
        _fetch_refs(job),
        cand.label,
        body.feedback,
        product.tryon_size_mm if product else None,
    )
    if img:
        url = storage.save_bytes(img, ".jpg")
        db.add(GenerationCandidate(job_id=job.id, label=cand.label, url=url))
    db.commit()
    return _load_job(db, job.id)


@router.post("/photoshoot/candidates/{cid}/approve", response_model=JobOut)
def approve(cid: int, db: Session = Depends(get_db)):
    cand = db.get(GenerationCandidate, cid)
    if cand is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    cand.approved = True
    # Add the approved shot to the product's gallery.
    job = _load_job(db, cand.job_id)
    product = db.get(Product, job.product_id)
    if cand.url not in (product.images or []):
        product.images = [*(product.images or []), cand.url]
    db.commit()
    return _load_job(db, cand.job_id)


@router.post("/photoshoot/candidates/{cid}/reject", response_model=JobOut)
def reject(cid: int, body: RejectRequest, db: Session = Depends(get_db)):
    cand = db.get(GenerationCandidate, cid)
    if cand is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    cand.comment = body.comment
    # Carry the comment up as the job's feedback for the next regeneration.
    job = db.get(GenerationJob, cand.job_id)
    if body.comment:
        job.feedback = body.comment
    db.commit()
    return _load_job(db, cand.job_id)


@router.get("/genai-check")
def genai_check():
    """Diagnose the Gemini connection (owner-only). Reports status, not the key."""
    return genai.diagnose()


@router.get("/products/{product_id}/photoshoots", response_model=list[JobOut])
def list_jobs(product_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(GenerationJob)
        .where(GenerationJob.product_id == product_id)
        .options(selectinload(GenerationJob.candidates))
        .order_by(GenerationJob.created_at.desc())
    )
    return db.scalars(stmt).all()


def _fetch_refs(job: GenerationJob) -> list[bytes]:
    """Re-download the stored reference images for (re)generation."""
    import httpx

    out: list[bytes] = []
    for url in job.reference_urls or []:
        try:
            r = httpx.get(url, timeout=30.0)
            r.raise_for_status()
            out.append(r.content)
        except Exception:
            pass
    return out
