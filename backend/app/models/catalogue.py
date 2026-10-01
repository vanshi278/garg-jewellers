"""Catalogue domain: Category -> Product -> ProductVariant.

Money is stored as Numeric(10, 2) (exact decimal rupees), never float.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True, nullable=False)
    # Self-referential parent for subcategories (e.g. Rings -> Adjustable Rings).
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    parent: Mapped[Category | None] = relationship(
        remote_side="Category.id", back_populates="children"
    )
    children: Mapped[list[Category]] = relationship(back_populates="parent")
    products: Mapped[list[Product]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metal: Mapped[str] = mapped_column(String(80), default="925 Sterling Silver")
    # List of image URLs; JSON is portable across SQLite and Postgres.
    images: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Fallback / "from" price shown on listing cards.
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Real-world size of the piece in millimetres (longest display dimension).
    # Drives the virtual try-on scale so the piece appears life-size on the
    # customer, instead of a manual size slider.
    tryon_size_mm: Mapped[Decimal | None] = mapped_column(Numeric(5, 1), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    category: Mapped[Category] = relationship(back_populates="products")
    variants: Mapped[list[ProductVariant]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )

    @property
    def in_stock(self) -> bool:
        return any(v.stock_qty > 0 for v in self.variants)


class ProductVariant(Base):
    __tablename__ = "product_variants"
    __table_args__ = (UniqueConstraint("sku", name="uq_variant_sku"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    # e.g. ring size "12", chain length "18 in", or "One size".
    label: Mapped[str] = mapped_column(String(80), default="One size")
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    weight_grams: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="variants")
