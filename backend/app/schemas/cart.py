"""Cart request/response schemas. Line totals and subtotal are computed
server-side so the client never has to trust its own arithmetic."""
from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field


class AddItemRequest(BaseModel):
    variant_id: int
    qty: int = Field(default=1, ge=1, le=99)


class UpdateItemRequest(BaseModel):
    qty: int = Field(ge=1, le=99)


class CartLine(BaseModel):
    item_id: int
    variant_id: int
    product_name: str
    product_slug: str
    variant_label: str
    image: str | None = None
    unit_price: Decimal
    qty: int
    line_total: Decimal
    stock_qty: int
    in_stock: bool


class CartOut(BaseModel):
    token: str
    lines: list[CartLine]
    subtotal: Decimal
    item_count: int


class MergeRequest(BaseModel):
    token: str  # the guest cart token to merge into the logged-in user's cart
