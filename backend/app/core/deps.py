"""Shared FastAPI dependencies for authentication and authorization."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.database import get_db
from app.models.user import Role, User

# auto_error=False so we can return a clean 401 rather than a bare 403.
bearer_scheme = HTTPBearer(auto_error=False)

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise _CREDENTIALS_EXC
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise _CREDENTIALS_EXC
    user_id = payload.get("sub")
    if user_id is None:
        raise _CREDENTIALS_EXC
    user = db.scalar(select(User).where(User.id == int(user_id)))
    if user is None:
        raise _CREDENTIALS_EXC
    return user


def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising — for endpoints
    that work for both guests and logged-in users (e.g. the cart)."""
    if creds is None:
        return None
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access" or payload.get("sub") is None:
        return None
    return db.scalar(select(User).where(User.id == int(payload["sub"])))


def require_role(*roles: Role):
    """Dependency factory: gate an endpoint (or a whole router) to given roles."""

    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _guard


# Convenience aliases.
require_owner = require_role(Role.owner)
require_customer = require_role(Role.customer)
