"""Orders. An order is created from the cart at checkout, stock is reserved,
and the order moves through a small status lifecycle as payment resolves.

Because some silver pieces are effectively one-of-a-kind, stock is decremented
when the order is created (reserved) and released if payment fails/expires.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _order_number() -> str:
    # Human-friendly, non-sequential reference shown to the customer.
    return "GJ-" + uuid.uuid4().hex[:8].upper()


class OrderStatus(str, enum.Enum):
    pending_payment = "pending_payment"  # created, stock reserved, awaiting pay
    paid = "paid"                        # payment confirmed
    cancelled = "cancelled"              # payment failed/expired, stock released
    shipped = "shipped"
    delivered = "delivered"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True, index=True, default=_order_number)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.pending_payment, index=True
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    shipping_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Shipping address, snapshotted onto the order.
    ship_name: Mapped[str] = mapped_column(String(120))
    ship_phone: Mapped[str] = mapped_column(String(20))
    ship_line1: Mapped[str] = mapped_column(String(255))
    ship_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ship_city: Mapped[str] = mapped_column(String(120))
    ship_state: Mapped[str] = mapped_column(String(120))
    ship_pincode: Mapped[str] = mapped_column(String(10))

    # Payment linkage.
    payment_provider: Mapped[str] = mapped_column(String(20), default="razorpay")
    provider_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"))
    # Snapshot fields so the order is stable even if the product later changes.
    product_name: Mapped[str] = mapped_column(String(200))
    variant_label: Mapped[str] = mapped_column(String(80))
    sku: Mapped[str] = mapped_column(String(64))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    qty: Mapped[int] = mapped_column(Integer)

    order: Mapped[Order] = relationship(back_populates="items")
