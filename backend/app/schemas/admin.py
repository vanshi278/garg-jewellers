"""Owner/admin schemas for catalogue and order management."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus


# ---- Categories ----
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=140)
    parent_id: int | None = None
    image_url: str | None = None
    sort_order: int = 0


# ---- Variants ----
class VariantCreate(BaseModel):
    label: str = Field(default="One size", max_length=80)
    sku: str = Field(min_length=1, max_length=64)
    weight_grams: Decimal | None = None
    price: Decimal = Field(gt=0)
    stock_qty: int = Field(ge=0, default=0)


class VariantUpdate(BaseModel):
    label: str | None = None
    price: Decimal | None = Field(default=None, gt=0)
    stock_qty: int | None = Field(default=None, ge=0)


# ---- Products ----
class ProductCreate(BaseModel):
    category_id: int
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=220)
    description: str | None = None
    images: list[str] = []
    base_price: Decimal = Field(gt=0)
    tryon_size_mm: Decimal | None = Field(default=None, gt=0, le=500)
    variants: list[VariantCreate] = []


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category_id: int | None = None
    images: list[str] | None = None
    base_price: Decimal | None = Field(default=None, gt=0)
    tryon_size_mm: Decimal | None = Field(default=None, gt=0, le=500)
    is_active: bool | None = None


# ---- Orders (admin view) ----
class AdminOrderRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    number: str
    status: OrderStatus
    total: Decimal
    ship_name: str
    ship_city: str
    created_at: datetime


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ---- Dashboard ----
class DashboardStats(BaseModel):
    total_products: int
    active_products: int
    low_stock_variants: int   # stock <= 2
    orders_pending: int
    orders_paid: int
    revenue_paid: Decimal
    unread_messages: int
