"""Contact-seller schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    message: str = Field(min_length=1, max_length=2000)
    product_slug: str | None = Field(default=None, max_length=220)


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    phone: str
    channel: str
    product_slug: str | None = None
    message: str
    is_read: bool
    created_at: datetime


class PublicConfig(BaseModel):
    """Public, non-secret settings the frontend needs at boot."""
    whatsapp_number: str
    razorpay_key_id: str  # empty string in mock mode
    currency: str = "INR"
    free_shipping_threshold: str
