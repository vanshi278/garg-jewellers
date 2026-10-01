"""Request/response schemas for the catalogue."""
from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class _ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- Category ----
class CategoryOut(_ORMModel):
    id: int
    name: str
    slug: str
    parent_id: int | None = None
    image_url: str | None = None
    sort_order: int = 0


# ---- Variant ----
class VariantOut(_ORMModel):
    id: int
    label: str
    sku: str
    weight_grams: Decimal | None = None
    price: Decimal
    stock_qty: int


# ---- Product ----
class ProductCard(_ORMModel):
    """Trimmed shape for listing grids."""
    id: int
    name: str
    slug: str
    metal: str
    base_price: Decimal
    images: list[str] = []
    in_stock: bool
    tryon_size_mm: Decimal | None = None


class ProductDetail(ProductCard):
    """Full product with variants for the detail page."""
    description: str | None = None
    category: CategoryOut
    variants: list[VariantOut] = []


class ProductList(BaseModel):
    items: list[ProductCard]
    total: int
    page: int
    page_size: int
