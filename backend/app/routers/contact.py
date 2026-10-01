"""Contact-seller (public) and a public config endpoint.

The WhatsApp deep link is built on the frontend from the number returned by
/api/config; this router backs the form fallback that writes to the owner inbox.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_optional_user
from app.database import get_db
from app.models.contact import ContactMessage
from app.models.user import User
from app.routers.orders import FREE_SHIPPING_THRESHOLD
from app.schemas.contact import ContactCreate, PublicConfig
from app.services import notifications

router = APIRouter(prefix="/api", tags=["contact"])


@router.get("/config", response_model=PublicConfig)
def public_config():
    return PublicConfig(
        whatsapp_number=settings.whatsapp_number,
        razorpay_key_id=settings.razorpay_key_id,  # "" => frontend uses mock flow
        free_shipping_threshold=str(FREE_SHIPPING_THRESHOLD),
    )


@router.post("/contact", status_code=201)
def submit_contact(
    body: ContactCreate,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    msg = ContactMessage(
        user_id=user.id if user else None,
        name=body.name,
        phone=body.phone,
        message=body.message,
        product_slug=body.product_slug,
        channel="form",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    notifications.send_contact_alert(msg)
    return {"ok": True, "message": "Thanks — we'll get back to you on WhatsApp or phone."}
