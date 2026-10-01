"""Public catalogue endpoints: categories, product listing, product detail."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.catalogue import Category, Product
from app.schemas.catalogue import (
    CategoryOut,
    ProductCard,
    ProductDetail,
    ProductList,
)

router = APIRouter(prefix="/api", tags=["catalogue"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    stmt = select(Category).order_by(Category.sort_order, Category.name)
    return db.scalars(stmt).all()


@router.get("/products", response_model=ProductList)
def list_products(
    category: str | None = Query(None, description="Category slug to filter by"),
    q: str | None = Query(None, description="Search text over product name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = [Product.is_active.is_(True)]

    if category:
        cat = db.scalar(select(Category).where(Category.slug == category))
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
        filters.append(Product.category_id == cat.id)

    if q:
        filters.append(Product.name.ilike(f"%{q}%"))

    total = db.scalar(select(func.count()).select_from(Product).where(*filters)) or 0

    stmt = (
        select(Product)
        .where(*filters)
        .options(selectinload(Product.variants))  # needed for in_stock
        .order_by(Product.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = db.scalars(stmt).all()
    return ProductList(
        items=[ProductCard.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/products/{slug}", response_model=ProductDetail)
def product_detail(slug: str, db: Session = Depends(get_db)):
    stmt = (
        select(Product)
        .where(Product.slug == slug, Product.is_active.is_(True))
        .options(
            selectinload(Product.variants),
            selectinload(Product.category),
        )
    )
    product = db.scalar(stmt)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
