"""Cart endpoints. Works for guests (via an X-Cart-Token header) and for
logged-in customers (via their bearer token). Guest carts merge on login.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_optional_user
from app.database import get_db
from app.models.cart import Cart, CartItem
from app.models.catalogue import Product, ProductVariant
from app.models.user import User
from app.schemas.cart import (
    AddItemRequest,
    CartLine,
    CartOut,
    MergeRequest,
    UpdateItemRequest,
)

router = APIRouter(prefix="/api/cart", tags=["cart"])


# ---- helpers ----
def _load_cart(db: Session, cart_id: int) -> Cart:
    return db.scalar(
        select(Cart)
        .where(Cart.id == cart_id)
        .options(selectinload(Cart.items).selectinload(CartItem.variant))
    )


def _user_cart(db: Session, user: User, create: bool) -> Cart | None:
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    if cart is None and create:
        cart = Cart(user_id=user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def _token_cart(db: Session, token: str | None, create: bool) -> Cart | None:
    cart = db.scalar(select(Cart).where(Cart.token == token)) if token else None
    if cart is None and create:
        cart = Cart()
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def _resolve_cart(
    db: Session, user: User | None, token: str | None, create: bool
) -> Cart | None:
    """A logged-in user always uses their own cart; guests use the token cart."""
    if user is not None:
        return _user_cart(db, user, create)
    return _token_cart(db, token, create)


def _serialize(db: Session, cart: Cart) -> CartOut:
    cart = _load_cart(db, cart.id)  # ensure relationships loaded
    lines: list[CartLine] = []
    subtotal = Decimal("0")
    count = 0
    for item in cart.items:
        variant: ProductVariant = item.variant
        product: Product = variant.product
        line_total = variant.price * item.qty
        subtotal += line_total
        count += item.qty
        lines.append(
            CartLine(
                item_id=item.id,
                variant_id=variant.id,
                product_name=product.name,
                product_slug=product.slug,
                variant_label=variant.label,
                image=(product.images[0] if product.images else None),
                unit_price=variant.price,
                qty=item.qty,
                line_total=line_total,
                stock_qty=variant.stock_qty,
                in_stock=variant.stock_qty >= item.qty,
            )
        )
    lines.sort(key=lambda l: l.item_id)
    return CartOut(token=cart.token, lines=lines, subtotal=subtotal, item_count=count)


# ---- endpoints ----
@router.get("", response_model=CartOut)
def get_cart(
    x_cart_token: str | None = Header(default=None),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    cart = _resolve_cart(db, user, x_cart_token, create=False)
    if cart is None:
        # Nothing yet — hand back an empty cart with a fresh token to store.
        cart = _resolve_cart(db, user, None, create=True)
    return _serialize(db, cart)


@router.post("/items", response_model=CartOut, status_code=201)
def add_item(
    body: AddItemRequest,
    x_cart_token: str | None = Header(default=None),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    variant = db.get(ProductVariant, body.variant_id)
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    if variant.stock_qty <= 0:
        raise HTTPException(status_code=409, detail="Out of stock")

    cart = _resolve_cart(db, user, x_cart_token, create=True)
    existing = db.scalar(
        select(CartItem).where(
            CartItem.cart_id == cart.id, CartItem.variant_id == variant.id
        )
    )
    desired = (existing.qty if existing else 0) + body.qty
    # Never let the cart exceed available stock.
    capped = min(desired, variant.stock_qty)
    if existing:
        existing.qty = capped
    else:
        db.add(CartItem(cart_id=cart.id, variant_id=variant.id, qty=capped))
    db.commit()
    return _serialize(db, cart)


@router.patch("/items/{item_id}", response_model=CartOut)
def update_item(
    item_id: int,
    body: UpdateItemRequest,
    x_cart_token: str | None = Header(default=None),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    cart = _resolve_cart(db, user, x_cart_token, create=False)
    item = db.get(CartItem, item_id) if cart else None
    if cart is None or item is None or item.cart_id != cart.id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    variant = db.get(ProductVariant, item.variant_id)
    item.qty = min(body.qty, variant.stock_qty)
    db.commit()
    return _serialize(db, cart)


@router.delete("/items/{item_id}", response_model=CartOut)
def remove_item(
    item_id: int,
    x_cart_token: str | None = Header(default=None),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    cart = _resolve_cart(db, user, x_cart_token, create=False)
    item = db.get(CartItem, item_id) if cart else None
    if cart is None or item is None or item.cart_id != cart.id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(item)
    db.commit()
    return _serialize(db, cart)


@router.post("/merge", response_model=CartOut)
def merge_cart(
    body: MergeRequest,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Fold a guest cart (by token) into the logged-in user's cart, then delete
    the guest cart. Called by the frontend right after login."""
    if user is None:
        raise HTTPException(status_code=401, detail="Login required to merge cart")

    guest = db.scalar(select(Cart).where(Cart.token == body.token))
    user_cart = _user_cart(db, user, create=True)
    if guest is None or guest.id == user_cart.id:
        return _serialize(db, user_cart)

    guest = _load_cart(db, guest.id)
    for gitem in guest.items:
        existing = db.scalar(
            select(CartItem).where(
                CartItem.cart_id == user_cart.id,
                CartItem.variant_id == gitem.variant_id,
            )
        )
        cap = gitem.variant.stock_qty
        if existing:
            existing.qty = min(existing.qty + gitem.qty, cap)
        else:
            db.add(
                CartItem(
                    cart_id=user_cart.id,
                    variant_id=gitem.variant_id,
                    qty=min(gitem.qty, cap),
                )
            )
    db.delete(guest)
    db.commit()
    return _serialize(db, user_cart)
