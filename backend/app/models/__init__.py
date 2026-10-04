"""Import all models here so Base.metadata sees them for create_all / Alembic."""
from app.models.cart import Cart, CartItem
from app.models.catalogue import Category, Product, ProductVariant
from app.models.contact import ContactMessage
from app.models.order import Order, OrderItem, OrderStatus
from app.models.photoshoot import GenerationCandidate, GenerationJob
from app.models.user import Role, User

__all__ = [
    "Cart",
    "CartItem",
    "Category",
    "ContactMessage",
    "GenerationCandidate",
    "GenerationJob",
    "Order",
    "OrderItem",
    "OrderStatus",
    "Product",
    "ProductVariant",
    "Role",
    "User",
]
