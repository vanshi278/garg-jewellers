"""Customer & owner notifications: email (SMTP), SMS (MSG91), WhatsApp (Meta
Cloud API).

Each channel degrades to *log-only mode* when its credentials aren't set, so the
app is fully wired in dev and goes live the moment real keys land in .env — the
same pattern as the Razorpay integration. Every send is wrapped so a provider
outage can never break checkout or the contact form.
"""
from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText

import httpx

from app.config import settings

log = logging.getLogger("garg.notifications")
# Ensure notification output is visible even though uvicorn doesn't configure
# the root logger at INFO.
if not log.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("INFO:     [notify] %(message)s"))
    log.addHandler(_handler)
    log.setLevel(logging.INFO)
    log.propagate = False

TIMEOUT = 10.0


# ---- Channels ----
def _send_email(to: str, subject: str, body: str) -> None:
    if not settings.email_enabled:
        log.info("[email:log-only] to=%s subject=%s\n%s", to, subject, body)
        return
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=TIMEOUT) as s:
        s.starttls()
        s.login(settings.smtp_user, settings.smtp_password)
        s.send_message(msg)


def _send_sms(to: str, text: str) -> None:
    if not settings.sms_enabled:
        log.info("[sms:log-only] to=%s\n%s", to, text)
        return
    # MSG91 flow/simple SMS endpoint.
    httpx.post(
        "https://api.msg91.com/api/v5/flow/",
        headers={"authkey": settings.msg91_auth_key},
        json={
            "sender": settings.msg91_sender_id,
            "short_url": "0",
            "mobiles": to,
            "message": text,
        },
        timeout=TIMEOUT,
    ).raise_for_status()


def _send_whatsapp(to: str, text: str) -> None:
    if not settings.whatsapp_enabled:
        log.info("[whatsapp:log-only] to=%s\n%s", to, text)
        return
    url = f"https://graph.facebook.com/v21.0/{settings.whatsapp_phone_number_id}/messages"
    httpx.post(
        url,
        headers={"Authorization": f"Bearer {settings.whatsapp_token}"},
        json={
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": text},
        },
        timeout=TIMEOUT,
    ).raise_for_status()


def _safe(fn, *args) -> None:
    """Run a channel send, swallowing any error so callers never fail."""
    try:
        fn(*args)
    except Exception:  # noqa: BLE001 — notifications must never break the flow
        log.exception("Notification send failed via %s", getattr(fn, "__name__", fn))


# ---- Public API ----
def send_order_confirmation(order) -> None:
    """Confirm a paid order to the customer (WhatsApp + SMS + email as available)."""
    lines = "\n".join(
        f"  • {it.product_name} ({it.variant_label}) ×{it.qty} — ₹{it.unit_price}"
        for it in order.items
    )
    text = (
        f"Thank you for your order with {settings.store_name}!\n\n"
        f"Order {order.number}\n{lines}\n\n"
        f"Total paid: ₹{order.total}\n"
        f"Shipping to: {order.ship_name}, {order.ship_city} {order.ship_pincode}\n\n"
        f"We'll message you when it ships."
    )
    phone = order.ship_phone
    if phone:
        _safe(_send_whatsapp, phone, text)
        _safe(_send_sms, phone, f"{settings.store_name}: order {order.number} confirmed. Total ₹{order.total}.")
    # Email the owner so they can begin fulfilment.
    _safe(
        _send_email,
        settings.owner_email,
        f"New paid order {order.number}",
        text,
    )


def send_contact_alert(message) -> None:
    """Alert the owner that a customer left a message via the contact form."""
    body = (
        f"New customer message via the website:\n\n"
        f"From: {message.name} ({message.phone})\n"
        f"{'Re: ' + message.product_slug if message.product_slug else ''}\n\n"
        f"{message.message}"
    )
    _safe(_send_email, settings.owner_email, "New customer enquiry", body)
    _safe(_send_sms, settings.whatsapp_number, f"New enquiry from {message.name} ({message.phone})")
