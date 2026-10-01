"""Application configuration, loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite:///./garg.db"

    # Auth
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    # CORS
    frontend_origin: str = "http://localhost:3000"

    # Public base URL of this API (used to build absolute image URLs).
    public_base_url: str = "http://localhost:8000"

    # Image storage: Cloudinary when configured (persists across redeploys),
    # else local disk (dev / VPS with a volume).
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # AI background removal (rembg) — needs ~1GB RAM. Turn OFF on small/free
    # hosts; enhance + zoom still run. Default on for local/bigger hosts.
    enable_bg_removal: bool = True

    # Seed owner
    owner_email: str = "owner@gargjewellers.in"
    owner_password: str = "change-me-owner"

    # Razorpay (blank => checkout runs in mock mode)
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # Contact
    whatsapp_number: str = "919999999999"

    # --- Notifications (all blank => log-only mode; wire real keys to go live) ---
    store_name: str = "Garg Jewellers"

    # Email via SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "orders@gargjewellers.in"

    # SMS via MSG91 (India)
    msg91_auth_key: str = ""
    msg91_sender_id: str = "GARGJW"

    # WhatsApp via Meta Cloud API
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""

    @property
    def razorpay_enabled(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    @property
    def cloudinary_enabled(self) -> bool:
        return bool(
            self.cloudinary_cloud_name
            and self.cloudinary_api_key
            and self.cloudinary_api_secret
        )

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def sms_enabled(self) -> bool:
        return bool(self.msg91_auth_key)

    @property
    def whatsapp_enabled(self) -> bool:
        return bool(self.whatsapp_token and self.whatsapp_phone_number_id)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
