"""Public live gold & silver price endpoint."""
from fastapi import APIRouter, Query

from app.services import metals

router = APIRouter(prefix="/api", tags=["metals"])


@router.get("/metals")
def live_metals(range: str = Query("1M")):
    return metals.get_prices(range)
