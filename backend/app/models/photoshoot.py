"""AI photoshoot: a GenerationJob holds the reference photos + settings for a
product, and GenerationCandidate rows are the AI's outputs the owner reviews.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    preset: Mapped[str] = mapped_column(String(40), default="white_studio")
    extra_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The reviewer's latest correction, fed into the next regeneration.
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Reference photo URLs (uploaded to storage), reused on regenerate.
    reference_urls: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Optional hint from the AI readiness check ("add a side angle").
    readiness_hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ready")  # ready|failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    candidates: Mapped[list["GenerationCandidate"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class GenerationCandidate(Base):
    __tablename__ = "generation_candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("generation_jobs.id", ondelete="CASCADE"), index=True
    )
    # Which shot in the set this is ("White packshot", "On model", …).
    label: Mapped[str] = mapped_column(String(40), default="")
    url: Mapped[str] = mapped_column(String(600))
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    job: Mapped[GenerationJob] = relationship(back_populates="candidates")
