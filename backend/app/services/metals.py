"""Live gold & silver prices + historical series for the storefront.

Source: Yahoo Finance chart API (no key) — gold/silver futures in USD/oz and
the USD→INR rate — converted to Indian retail units (gold ₹/10g 24K, silver
₹/kg). Results are cached in-memory with a TTL so we don't hammer the source,
and the last good payload is served if a refresh fails.
"""
from __future__ import annotations

import logging
import time

import httpx

log = logging.getLogger("garg.metals")

CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
UA = {"User-Agent": "Mozilla/5.0"}
GRAMS_PER_OZ = 31.1034768
TTL_SECONDS = 20 * 60

# range -> (yahoo range, interval)
RANGES = {
    "1W": ("5d", "1d"),
    "1M": ("1mo", "1d"),
    "1Y": ("1y", "1wk"),
    "5Y": ("5y", "1mo"),
}

_cache: dict[str, tuple[float, dict]] = {}


def _series(symbol: str, yrange: str, interval: str) -> list[tuple[int, float]]:
    r = httpx.get(
        CHART.format(symbol=symbol),
        params={"range": yrange, "interval": interval},
        headers=UA,
        timeout=20.0,
    )
    r.raise_for_status()
    res = r.json()["chart"]["result"][0]
    ts = res["timestamp"]
    closes = res["indicators"]["quote"][0]["close"]
    return [(int(t) * 1000, float(c)) for t, c in zip(ts, closes) if c is not None]


def _latest(points: list[tuple[int, float]]) -> float:
    return points[-1][1]


def get_prices(range_key: str) -> dict:
    range_key = range_key if range_key in RANGES else "1M"
    now = time.time()
    cached = _cache.get(range_key)
    if cached and now - cached[0] < TTL_SECONDS:
        return cached[1]

    yrange, interval = RANGES[range_key]
    try:
        gold_oz = _series("GC=F", yrange, interval)
        silver_oz = _series("SI=F", yrange, interval)
        fx = _latest(_series("INR=X", "5d", "1d"))  # USD -> INR

        def to_inr_per_g(usd_oz: float) -> float:
            return usd_oz / GRAMS_PER_OZ * fx

        # Indian retail units: gold ₹/10g (24K), silver ₹/kg.
        gold_series = [{"t": t, "v": round(to_inr_per_g(v) * 10, 1)} for t, v in gold_oz]
        silver_series = [{"t": t, "v": round(to_inr_per_g(v) * 1000, 1)} for t, v in silver_oz]

        def pack(series: list[dict], unit: str) -> dict:
            first, last = series[0]["v"], series[-1]["v"]
            change = round((last - first) / first * 100, 2) if first else 0.0
            return {"unit": unit, "price": last, "change_pct": change, "series": series}

        payload = {
            "range": range_key,
            "updated": int(now * 1000),
            "available": True,
            "gold": pack(gold_series, "₹ / 10g · 24K"),
            "silver": pack(silver_series, "₹ / kg"),
        }
        _cache[range_key] = (now, payload)
        return payload
    except Exception:
        log.exception("Metals price fetch failed")
        if cached:
            return {**cached[1], "stale": True}
        return {"range": range_key, "available": False}
