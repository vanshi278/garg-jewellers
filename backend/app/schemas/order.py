"""Order + checkout schemas."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus


class ShippingAddress(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    line1: str = Field(min_length=1, max_length=255)
    line2: str | None = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    pincode: str = Field(min_length=4, max_length=10)


class CheckoutRequest(BaseModel):
    address: ShippingAddress


class PaymentInit(BaseModel):
    """Everything the frontend Razorpay Checkout widget needs to open."""
    order_number: str
    provider_order_id: str
    amount: int  # in paise
    currency: str
    key_id: str
    mock: bool


class ConfirmPaymentRequest(BaseModel):
    order_number: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_name: str
    variant_label: str
    sku: str
    unit_price: Decimal
    qty: int


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    number: str
    status: OrderStatus
    subtotal: Decimal
    shipping_fee: Decimal
    total: Decimal
    ship_name: str
    ship_city: str
    ship_state: str
    ship_pincode: str
    created_at: datetime
    items: list[OrderItemOut] = []
