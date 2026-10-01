"""Checkout and orders (customer-facing).

Flow (architecture §8):
  1. POST /api/checkout   — build order from the user's cart, RESERVE stock,
                            create a Razorpay order, return payment init data.
  2. POST /api/checkout/confirm — verify the payment signature, mark paid,
                            clear the cart, (notifications hook).
  3. Razorpay also calls POST /api/orders/webhook as the source of truth.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.cart import Cart, CartItem
from app.models.catalogue import ProductVariant
from app.models.order import Order, OrderItem, OrderStatus
from app.models.user import User
from app.schemas.order import (
    CheckoutRequest,
    ConfirmPaymentRequest,
    OrderOut,
    PaymentInit,
)
from app.services import notifications, payments

router = APIRouter(prefix="/api", tags=["checkout"])

FREE_SHIPPING_THRESHOLD = Decimal("2000")
SHIPPING_FEE = Decimal("79")


def _load_order(db: Session, number: str, user_id: int | None = None) -> Order | None:
    stmt = select(Order).where(Order.number == number).options(selectinload(Order.items))
    if user_id is not None:
        stmt = stmt.where(Order.user_id == user_id)
    return db.scalar(stmt)


def _release_stock(db: Session, order: Order) -> None:
    for item in order.items:
        variant = db.get(ProductVariant, item.variant_id)
        if variant:
            variant.stock_qty += item.qty


@router.post("/checkout", response_model=PaymentInit)
def checkout(
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = db.scalar(
        select(Cart)
        .where(Cart.user_id == user.id)
        .options(selectinload(Cart.items).selectinload(CartItem.variant))
    )
    if cart is None or not cart.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    # Re-check stock at the last moment and reserve it atomically.
    subtotal = Decimal("0")
    order_items: list[OrderItem] = []
    for item in cart.items:
        variant: ProductVariant = item.variant
        if variant.stock_qty < item.qty:
            raise HTTPException(
                status_code=409,
                detail=f"Only {variant.stock_qty} left of {variant.product.name} ({variant.label})",
            )
        subtotal += variant.price * item.qty
        order_items.append(
            OrderItem(
                variant_id=variant.id,
                product_name=variant.product.name,
                variant_label=variant.label,
                sku=variant.sku,
                unit_price=variant.price,
                qty=item.qty,
            )
        )

    shipping = Decimal("0") if subtotal >= FREE_SHIPPING_THRESHOLD else SHIPPING_FEE
    total = subtotal + shipping
    addr = body.address

    order = Order(
        user_id=user.id,
        status=OrderStatus.pending_payment,
        subtotal=subtotal,
        shipping_fee=shipping,
        total=total,
        ship_name=addr.name,
        ship_phone=addr.phone,
        ship_line1=addr.line1,
        ship_line2=addr.line2,
        ship_city=addr.city,
        ship_state=addr.state,
        ship_pincode=addr.pincode,
        items=order_items,
    )
    db.add(order)

    # Reserve stock now so two shoppers can't win the same one-of-a-kind piece.
    for item in cart.items:
        item.variant.stock_qty -= item.qty
    db.flush()

    pay = payments.create_order(total, receipt=order.number)
    order.provider_order_id = pay["provider_order_id"]
    db.commit()
    db.refresh(order)

    return PaymentInit(
        order_number=order.number,
        provider_order_id=pay["provider_order_id"],
        amount=pay["amount"],
        currency=pay["currency"],
        key_id=pay["key_id"],
        mock=pay["mock"],
    )


@router.post("/checkout/confirm", response_model=OrderOut)
def confirm_payment(
    body: ConfirmPaymentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = _load_order(db, body.order_number, user_id=user.id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == OrderStatus.paid:
        return order  # idempotent — webhook may have arrived first

    ok = payments.verify_payment_signature(
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    order.status = OrderStatus.paid
    order.provider_payment_id = body.razorpay_payment_id

    # Clear the user's cart now that the order is paid.
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()

    db.commit()
    db.refresh(order)
    notifications.send_order_confirmation(order)
    return order


@router.post("/orders/webhook", status_code=200)
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Razorpay's server-to-server confirmation — the source of truth for
    payment state, independent of whether the browser completed the redirect."""
    raw = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not payments.verify_webhook_signature(raw, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json

    event = json.loads(raw or b"{}")
    entity = (
        event.get("payload", {}).get("payment", {}).get("entity", {})
    )
    provider_order_id = entity.get("order_id")
    payment_id = entity.get("id")
    event_type = event.get("event", "")

    if not provider_order_id:
        return {"ok": True, "ignored": True}

    order = db.scalar(select(Order).where(Order.provider_order_id == provider_order_id))
    if order is None:
        return {"ok": True, "ignored": True}

    if event_type == "payment.captured" and order.status != OrderStatus.paid:
        order.status = OrderStatus.paid
        order.provider_payment_id = payment_id
        db.commit()
        notifications.send_order_confirmation(_load_order(db, order.number))
    elif event_type == "payment.failed" and order.status == OrderStatus.pending_payment:
        order.status = OrderStatus.cancelled
        _release_stock(db, _load_order(db, order.number))
        db.commit()

    return {"ok": True}


@router.get("/me/orders", response_model=list[OrderOut])
def my_orders(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Order)
        .where(Order.user_id == user.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.get("/me/orders/{number}", response_model=OrderOut)
def my_order_detail(
    number: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = _load_order(db, number, user_id=user.id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
