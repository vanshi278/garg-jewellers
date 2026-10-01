"""Authentication: customer signup/login, owner login, token refresh, /me.

Customer and owner login are separate endpoints on purpose (see architecture
§4): the owner path is isolated and never exposes a signup route.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.user import Role, User
from app.schemas.auth import (
    CustomerSignup,
    LoginRequest,
    RefreshRequest,
    TokenPair,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_tokens(user: User) -> TokenPair:
    sub = str(user.id)
    return TokenPair(
        access_token=create_access_token(sub, user.role.value),
        refresh_token=create_refresh_token(sub, user.role.value),
    )


def _find_by_identifier(db: Session, identifier: str) -> User | None:
    return db.scalar(
        select(User).where(or_(User.email == identifier, User.phone == identifier))
    )


# ---- Customer ----
@router.post("/customer/signup", response_model=TokenPair, status_code=201)
def customer_signup(body: CustomerSignup, db: Session = Depends(get_db)):
    exists = db.scalar(
        select(User).where(
            or_(
                User.email == body.email,
                (User.phone == body.phone) if body.phone else False,
            )
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="An account with those details already exists")

    user = User(
        name=body.name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=Role.customer,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_tokens(user)


@router.post("/customer/login", response_model=TokenPair)
def customer_login(body: LoginRequest, db: Session = Depends(get_db)):
    user = _find_by_identifier(db, body.identifier)
    if (
        user is None
        or user.role != Role.customer
        or not user.password_hash
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return _issue_tokens(user)


# ---- Owner ----
@router.post("/admin/login", response_model=TokenPair)
def owner_login(body: LoginRequest, db: Session = Depends(get_db)):
    user = _find_by_identifier(db, body.identifier)
    # Deliberately identical error to avoid revealing whether an owner exists.
    if (
        user is None
        or user.role != Role.owner
        or not user.password_hash
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # TODO: if user.totp_secret is set, require a second-factor challenge here.
    return _issue_tokens(user)


# ---- Shared ----
@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.scalar(select(User).where(User.id == int(payload["sub"])))
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return _issue_tokens(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
