"""Razorpay integration with a mock fallback.

When RAZORPAY_KEY_ID/SECRET are unset the module runs in *mock mode*: it fakes
order creation and signature verification so the whole checkout flow is testable
end-to-end locally. The moment real keys land in .env, the same code path calls
the live API — no endpoint changes needed.
"""
from __future__ import annotations

import hashlib
import hmac
import uuid
from decimal import Decimal

from app.config import settings

_client = None
if settings.razorpay_enabled:
    import razorpay  # imported lazily so the dep isn't required in mock mode

    _client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def to_paise(amount: Decimal) -> int:
    """Razorpay works in the smallest currency unit (paise)."""
    return int((amount * 100).to_integral_value())


def create_order(amount: Decimal, receipt: str) -> dict:
    """Create a payment order. Returns provider order id + the key id the
    frontend Checkout widget needs. Mock mode returns a fake but well-formed id.
    """
    amount_paise = to_paise(amount)
    if _client is None:
        return {
            "provider_order_id": "order_mock_" + uuid.uuid4().hex[:14],
            "amount": amount_paise,
            "currency": "INR",
            "key_id": "rzp_test_mock",
            "mock": True,
        }
    order = _client.order.create(
        {"amount": amount_paise, "currency": "INR", "receipt": receipt}
    )
    return {
        "provider_order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": settings.razorpay_key_id,
        "mock": False,
    }


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify the checkout callback signature. In mock mode, accept the sentinel
    signature 'mock_signature' so local flows can complete."""
    if _client is None:
        return signature == "mock_signature"
    try:
        _client.utility.verify_payment_signature(
            {
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": signature,
            }
        )
        return True
    except Exception:
        return False


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verify a Razorpay webhook using the configured webhook secret."""
    secret = settings.razorpay_webhook_secret
    if not secret:
        # No secret configured (mock/dev): accept the sentinel.
        return signature == "mock_webhook_signature"
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
