"""Owner console API. The whole router is gated to role=owner by a single
router-level dependency (architecture §4, §10)."""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_owner
from app.database import get_db
from app.models.catalogue import Category, Product, ProductVariant
from app.models.contact import ContactMessage
from app.models.order import Order, OrderStatus
from app.schemas.admin import (
    AdminOrderRow,
    CategoryCreate,
    DashboardStats,
    OrderStatusUpdate,
    ProductCreate,
    ProductUpdate,
    VariantCreate,
    VariantUpdate,
)
from app.schemas.catalogue import CategoryOut, ProductDetail, VariantOut
from app.schemas.contact import ContactOut

# Every route here requires an authenticated owner.
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_owner)])


# ---- Dashboard ----
@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db)):
    total_products = db.scalar(select(func.count()).select_from(Product)) or 0
    active_products = (
        db.scalar(select(func.count()).select_from(Product).where(Product.is_active.is_(True))) or 0
    )
    low_stock = (
        db.scalar(select(func.count()).select_from(ProductVariant).where(ProductVariant.stock_qty <= 2))
        or 0
    )
    pending = (
        db.scalar(select(func.count()).select_from(Order).where(Order.status == OrderStatus.pending_payment))
        or 0
    )
    paid = db.scalar(select(func.count()).select_from(Order).where(Order.status == OrderStatus.paid)) or 0
    revenue = (
        db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(Order.status == OrderStatus.paid))
        or Decimal("0")
    )
    unread = (
        db.scalar(select(func.count()).select_from(ContactMessage).where(ContactMessage.is_read.is_(False)))
        or 0
    )
    return DashboardStats(
        total_products=total_products,
        active_products=active_products,
        low_stock_variants=low_stock,
        orders_pending=pending,
        orders_paid=paid,
        revenue_paid=Decimal(revenue),
        unread_messages=unread,
    )


# ---- Categories ----
@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Category).where(Category.slug == body.slug)):
        raise HTTPException(status_code=409, detail="Slug already exists")
    cat = Category(**body.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ---- Products ----
@router.post("/products", response_model=ProductDetail, status_code=201)
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    if db.get(Category, body.category_id) is None:
        raise HTTPException(status_code=400, detail="Category not found")
    if db.scalar(select(Product).where(Product.slug == body.slug)):
        raise HTTPException(status_code=409, detail="Slug already exists")

    product = Product(
        category_id=body.category_id,
        name=body.name,
        slug=body.slug,
        description=body.description,
        images=body.images,
        base_price=body.base_price,
        tryon_size_mm=body.tryon_size_mm,
        variants=[ProductVariant(**v.model_dump()) for v in body.variants],
    )
    db.add(product)
    db.commit()
    # Reload with relationships for the response.
    return db.scalar(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.variants), selectinload(Product.category))
    )


@router.patch("/products/{product_id}", response_model=ProductDetail)
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    return db.scalar(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.variants), selectinload(Product.category))
    )


@router.post("/products/{product_id}/variants", response_model=VariantOut, status_code=201)
def add_variant(product_id: int, body: VariantCreate, db: Session = Depends(get_db)):
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if db.scalar(select(ProductVariant).where(ProductVariant.sku == body.sku)):
        raise HTTPException(status_code=409, detail="SKU already exists")
    variant = ProductVariant(product_id=product_id, **body.model_dump())
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


@router.patch("/variants/{variant_id}", response_model=VariantOut)
def update_variant(variant_id: int, body: VariantUpdate, db: Session = Depends(get_db)):
    variant = db.get(ProductVariant, variant_id)
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(variant, field, value)
    db.commit()
    db.refresh(variant)
    return variant


# ---- Orders ----
@router.get("/orders", response_model=list[AdminOrderRow])
def list_orders(
    status: OrderStatus | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Order).order_by(Order.created_at.desc())
    if status:
        stmt = stmt.where(Order.status == status)
    return db.scalars(stmt).all()


@router.patch("/orders/{number}", response_model=AdminOrderRow)
def update_order_status(number: str, body: OrderStatusUpdate, db: Session = Depends(get_db)):
    order = db.scalar(select(Order).where(Order.number == number))
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = body.status
    db.commit()
    db.refresh(order)
    return order


# ---- Contact inbox ----
@router.get("/messages", response_model=list[ContactOut])
def list_messages(unread_only: bool = False, db: Session = Depends(get_db)):
    stmt = select(ContactMessage).order_by(ContactMessage.created_at.desc())
    if unread_only:
        stmt = stmt.where(ContactMessage.is_read.is_(False))
    return db.scalars(stmt).all()


@router.patch("/messages/{message_id}/read", response_model=ContactOut)
def mark_message_read(message_id: int, db: Session = Depends(get_db)):
    msg = db.get(ContactMessage, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.is_read = True
    db.commit()
    db.refresh(msg)
    return msg
