"""AI photoshoot schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    url: str
    approved: bool
    comment: str | None = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    preset: str
    extra_prompt: str | None = None
    feedback: str | None = None
    reference_urls: list[str] = []
    readiness_hint: str | None = None
    status: str
    created_at: datetime
    candidates: list[CandidateOut] = []


class RegenerateRequest(BaseModel):
    # The reviewer's correction, folded into the next generation.
    feedback: str | None = Field(default=None, max_length=1000)


class RejectRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=1000)
