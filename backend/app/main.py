"""FastAPI application entrypoint for Garg Jewellers."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import select

from app.config import settings
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models.user import Role, User
from app.routers import admin, auth, cart, catalogue, contact, metals, orders, photoshoot, uploads

# Import models so Base.metadata is fully populated before create_all.
import app.models  # noqa: F401


def _seed_owner() -> None:
    """Create the single owner account from env if none exists yet."""
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.role == Role.owner))
        if existing is None:
            db.add(
                User(
                    name="Store Owner",
                    email=settings.owner_email,
                    password_hash=hash_password(settings.owner_password),
                    role=Role.owner,
                )
            )
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev convenience: create tables on startup. Use Alembic migrations in prod.
    Base.metadata.create_all(bind=engine)
    _seed_owner()
    yield


app = FastAPI(
    title="Garg Jewellers API",
    version="0.1.0",
    description="Backend for the Garg Jewellers 925 sterling silver store.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalogue.router)
app.include_router(auth.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(contact.router)
app.include_router(admin.router)
app.include_router(uploads.router)
app.include_router(photoshoot.router)
app.include_router(metals.router)

# Serve uploaded product images.
_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


@app.get("/health", tags=["meta"])
def health():
    # Booleans only — never the keys themselves.
    return {
        "status": "ok",
        "razorpay": settings.razorpay_enabled,
        "gemini": settings.gemini_enabled,
        "cloudinary": settings.cloudinary_enabled,
    }
