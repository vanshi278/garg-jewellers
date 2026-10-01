"""Seed the database with sample 925 sterling silver catalogue data.

Run from the backend/ directory:  python -m app.seed
Idempotent-ish: it wipes catalogue tables and re-inserts, so re-run freely in dev.
"""
from decimal import Decimal

from app.database import Base, SessionLocal, engine
from app.models.catalogue import Category, Product, ProductVariant

# Import all models so create_all builds the full schema.
import app.models  # noqa: F401


CATEGORIES = [
    {"name": "Rings", "slug": "rings", "sort_order": 1},
    {"name": "Earrings", "slug": "earrings", "sort_order": 2},
    {"name": "Necklaces & Pendants", "slug": "necklaces", "sort_order": 3},
    {"name": "Bracelets & Bangles", "slug": "bracelets", "sort_order": 4},
    {"name": "Anklets", "slug": "anklets", "sort_order": 5},
    {"name": "Nose Pins", "slug": "nose-pins", "sort_order": 6},
]

# (category slug, name, slug, description, base_price, [variants])
# variant = (label, sku, weight_grams, price, stock_qty)
PRODUCTS = [
    (
        "rings", "Solitaire Zircon Ring", "solitaire-zircon-ring",
        "A classic 925 sterling silver solitaire set with a brilliant-cut zircon. Rhodium-finished for lasting shine.",
        Decimal("1499.00"),
        [
            ("Size 10", "RNG-SOL-10", Decimal("2.80"), Decimal("1499.00"), 4),
            ("Size 12", "RNG-SOL-12", Decimal("3.00"), Decimal("1499.00"), 3),
            ("Size 14", "RNG-SOL-14", Decimal("3.20"), Decimal("1599.00"), 2),
        ],
    ),
    (
        "rings", "Twisted Band Ring", "twisted-band-ring",
        "Hand-finished twisted band in pure 925 silver. Everyday-wearable, oxidised detailing.",
        Decimal("999.00"),
        [
            ("Size 12", "RNG-TWB-12", Decimal("2.40"), Decimal("999.00"), 6),
            ("Size 16", "RNG-TWB-16", Decimal("2.70"), Decimal("1049.00"), 5),
        ],
    ),
    (
        "earrings", "Silver Jhumka Earrings", "silver-jhumka-earrings",
        "Traditional jhumkas crafted in 925 sterling silver with intricate filigree bells.",
        Decimal("2299.00"),
        [
            ("One size", "EAR-JHU-OS", Decimal("8.50"), Decimal("2299.00"), 5),
        ],
    ),
    (
        "earrings", "Zircon Stud Earrings", "zircon-stud-earrings",
        "Minimal round zircon studs in 925 silver — the pair you reach for daily.",
        Decimal("799.00"),
        [
            ("One size", "EAR-STD-OS", Decimal("1.80"), Decimal("799.00"), 12),
        ],
    ),
    (
        "necklaces", "Rani Haar Pendant Set", "rani-haar-pendant-set",
        "Statement 925 silver pendant on an 18-inch box chain, with matching drop earrings.",
        Decimal("3499.00"),
        [
            ('18 in', "NCK-RAN-18", Decimal("14.00"), Decimal("3499.00"), 3),
            ('20 in', "NCK-RAN-20", Decimal("15.20"), Decimal("3699.00"), 2),
        ],
    ),
    (
        "necklaces", "Dainty Heart Pendant", "dainty-heart-pendant",
        "A delicate heart pendant on a fine 925 silver chain. Adjustable length.",
        Decimal("1199.00"),
        [
            ('16-18 in', "NCK-HRT-1618", Decimal("3.10"), Decimal("1199.00"), 8),
        ],
    ),
    (
        "bracelets", "Oxidised Cuff Bangle", "oxidised-cuff-bangle",
        "Adjustable oxidised 925 silver cuff with tribal engraving. Open-back fit.",
        Decimal("1799.00"),
        [
            ("Free size", "BRC-CUF-FS", Decimal("11.00"), Decimal("1799.00"), 4),
        ],
    ),
    (
        "bracelets", "Charm Chain Bracelet", "charm-chain-bracelet",
        "Fine 925 silver chain bracelet with a single zircon charm and lobster clasp.",
        Decimal("1099.00"),
        [
            ('7 in', "BRC-CHM-7", Decimal("4.20"), Decimal("1099.00"), 7),
        ],
    ),
    (
        "anklets", "Ghungroo Anklet Pair", "ghungroo-anklet-pair",
        "Pair of 925 silver anklets with tiny ghungroo bells. Sold as a pair.",
        Decimal("2599.00"),
        [
            ('10 in', "ANK-GHU-10", Decimal("18.00"), Decimal("2599.00"), 3),
        ],
    ),
    (
        "nose-pins", "Pressing Nose Pin", "pressing-nose-pin",
        "Non-pierced pressing nose pin in 925 silver with a single zircon. No piercing needed.",
        Decimal("499.00"),
        [
            ("One size", "NOS-PRS-OS", Decimal("0.60"), Decimal("499.00"), 20),
        ],
    ),
]

# Placeholder image (public-domain style neutral). Replace with real product photos.
PLACEHOLDER = [
    "https://placehold.co/800x800/f1e7d8/8a5a34?text=925+Silver",
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Clean slate for catalogue tables.
        db.query(ProductVariant).delete()
        db.query(Product).delete()
        db.query(Category).delete()
        db.commit()

        cat_by_slug: dict[str, Category] = {}
        for c in CATEGORIES:
            cat = Category(**c)
            db.add(cat)
            cat_by_slug[c["slug"]] = cat
        db.commit()

        for cat_slug, name, slug, desc, base_price, variants in PRODUCTS:
            product = Product(
                category_id=cat_by_slug[cat_slug].id,
                name=name,
                slug=slug,
                description=desc,
                images=list(PLACEHOLDER),
                base_price=base_price,
            )
            db.add(product)
            db.flush()  # get product.id
            for label, sku, weight, price, stock in variants:
                db.add(
                    ProductVariant(
                        product_id=product.id,
                        label=label,
                        sku=sku,
                        weight_grams=weight,
                        price=price,
                        stock_qty=stock,
                    )
                )
        db.commit()

        n_products = db.query(Product).count()
        n_variants = db.query(ProductVariant).count()
        print(f"Seeded {len(CATEGORIES)} categories, {n_products} products, {n_variants} variants.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
