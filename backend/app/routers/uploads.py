"""Owner image uploads for product photos.

Image bytes go through app.services.storage, which saves to Cloudinary when
configured (persists across redeploys) or the local uploads/ folder otherwise.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_owner
from app.database import get_db
from app.models.catalogue import Product
from app.schemas.catalogue import ProductDetail
from app.services import imaging, storage

router = APIRouter(
    prefix="/api/admin",
    tags=["admin-uploads"],
    dependencies=[Depends(require_owner)],
)

ALLOWED = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB


class RemoveImageBody(BaseModel):
    url: str


def _load_detail(db: Session, product_id: int) -> Product:
    return db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.variants), selectinload(Product.category))
    )


@router.post("/products/{product_id}/images", response_model=ProductDetail)
async def upload_image(
    product_id: int,
    file: UploadFile = File(...),
    expand: bool = True,  # one upload -> enhanced main + zoom + bg variants
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    if (file.content_type or "") not in ALLOWED:
        raise HTTPException(status_code=415, detail="Only JP, PNG or WebP images are allowed")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 5 MB")

    # Enhance the upload and (by default) expand it into faithful variants.
    try:
        variants = imaging.generate_variants(data)
        if not expand:
            variants = variants[:1]  # just the enhanced cover
    except Exception:
        # Never let processing block an upload — fall back to the raw bytes.
        variants = [("main", data)]

    new_urls = [storage.save_bytes(jpeg, ".jpg") for _label, jpeg in variants]

    # images is a JSON column; reassign a new list so SQLAlchemy tracks the change.
    product.images = [*(product.images or []), *new_urls]
    db.commit()
    return _load_detail(db, product_id)


@router.delete("/products/{product_id}/images", response_model=ProductDetail)
def remove_image(
    product_id: int,
    body: RemoveImageBody,
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    product.images = [u for u in (product.images or []) if u != body.url]
    db.commit()

    storage.delete(body.url)  # best-effort (local file or Cloudinary asset)
    return _load_detail(db, product_id)
