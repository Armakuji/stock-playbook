#!/usr/bin/env python3
"""Key-free market data fetcher — Stock Playbook Research.

Grabs live quote and valuation-ratio data from free public endpoints with a
provider-fallback chain (Yahoo → Finviz → Stooq). No API key required.

Public functions (stable API — referenced by references/scoring.md):
- get_quote(ticker)   -> price / market cap / volume / 52-week range
- get_ratios(ticker)  -> P/E, dividend yield, beta

CLI:
    python3 tools/market.py AAPL
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import time
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import requests

# ── HTTP layer ───────────────────────────────────────────────────────────────

USER_AGENT = "stockplaybook/1.0 (nitipon.ching@gmail.com)"
REQUEST_TIMEOUT = 20
RETRY_ATTEMPTS = 3
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


def _http_get(url: str) -> requests.Response:
    """GET with exponential backoff on transient failures."""
    delay = 1.0
    for attempt in range(RETRY_ATTEMPTS):
        try:
            resp = requests.get(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
                },
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code in RETRY_STATUSES:
                raise requests.HTTPError(f"transient {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp
        except requests.RequestException:
            if attempt == RETRY_ATTEMPTS - 1:
                raise
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


# ── Parsing helpers ──────────────────────────────────────────────────────────

_SCALE = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}


def _num(value: Any) -> Optional[float]:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def _num_compact(raw: str) -> Optional[float]:
    """Parse Finviz-style compact numbers: '1.2B', '$45.30', '3,400', 'N/A'."""
    text = raw.strip().replace(",", "").lstrip("$~")
    if not text or text.upper() == "N/A":
        return None
    scale = _SCALE.get(text[-1].upper())
    if scale:
        text = text[:-1]
    value = _num(text)
    return value * scale if (value is not None and scale) else value


def _num_percent(raw: str) -> Optional[float]:
    return _num(raw.strip().rstrip("%")) if raw.strip().upper() != "N/A" else None


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ── Providers ────────────────────────────────────────────────────────────────
# Every provider returns the same shape (or None when it has no price):
# {provider, price, currency, market_cap, volume, high_52w, low_52w,
#  pe, dividend_yield_pct, beta}


def _from_yahoo(ticker: str) -> Optional[dict[str, Any]]:
    url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={ticker}"
    rows = _http_get(url).json().get("quoteResponse", {}).get("result", [])
    if not rows:
        return None
    q = rows[0]
    price = _num(q.get("regularMarketPrice"))
    if price is None:
        return None
    dividend_yield = _num(q.get("dividendYield"))
    return {
        "provider": "yahoo",
        "price": price,
        "currency": q.get("currency", "USD"),
        "market_cap": _num(q.get("marketCap")),
        "volume": _num(q.get("regularMarketVolume")),
        "high_52w": _num(q.get("fiftyTwoWeekHigh")),
        "low_52w": _num(q.get("fiftyTwoWeekLow")),
        "pe": _num(q.get("trailingPE")),
        "dividend_yield_pct": dividend_yield * 100 if dividend_yield is not None else None,
        "beta": _num(q.get("beta")),
    }


_FINVIZ_CELL = re.compile(r"<td[^>]*>([^<]+)</td><td[^>]*>(?:<b>)?([^<]+)")
_FINVIZ_RANGE = re.compile(r"([0-9]+\.?[0-9]*)\s*-\s*([0-9]+\.?[0-9]*)")


def _from_finviz(ticker: str) -> Optional[dict[str, Any]]:
    html = _http_get(f"https://finviz.com/quote.ashx?t={ticker.upper()}").text
    table = {k.strip(): v.strip() for k, v in _FINVIZ_CELL.findall(html)}
    price = _num_compact(table.get("Price", ""))
    if price is None:
        return None
    low_52w = high_52w = None
    if m := _FINVIZ_RANGE.search(table.get("52W Range", "")):
        low_52w, high_52w = _num(m.group(1)), _num(m.group(2))
    return {
        "provider": "finviz",
        "price": price,
        "currency": "USD",
        "market_cap": _num_compact(table.get("Market Cap", "")),
        "volume": _num_compact(table.get("Volume", "")),
        "high_52w": high_52w,
        "low_52w": low_52w,
        "pe": _num_compact(table.get("P/E", "")),
        "dividend_yield_pct": _num_percent(table.get("Dividend %", "")),
        "beta": _num(table.get("Beta")),
    }


def _from_stooq(ticker: str) -> Optional[dict[str, Any]]:
    if "." in ticker:  # Stooq's .us suffix scheme clashes with dotted tickers
        return None
    url = f"https://stooq.com/q/l/?s={ticker.lower()}.us&f=sd2t2ohlcv&h&e=csv"
    row = next(csv.DictReader(io.StringIO(_http_get(url).text)), None)
    price = _num(row.get("Close")) if row else None
    if price is None:
        return None
    return {
        "provider": "stooq",
        "price": price,
        "currency": "USD",
        "market_cap": None,
        "volume": _num(row.get("Volume")),
        "high_52w": None,
        "low_52w": None,
        "pe": None,
        "dividend_yield_pct": None,
        "beta": None,
    }


PROVIDER_CHAIN: tuple[Callable[[str], Optional[dict[str, Any]]], ...] = (
    _from_yahoo,
    _from_finviz,
    _from_stooq,
)

_RATIO_KEYS = ("pe", "dividend_yield_pct", "beta")


def _walk_providers(ticker: str, want_ratios: bool) -> Optional[dict[str, Any]]:
    """First provider with a price wins; for ratios, keep walking until one
    also carries ratio data (falling back to the first priced result)."""
    priced: Optional[dict[str, Any]] = None
    for provider in PROVIDER_CHAIN:
        try:
            result = provider(ticker)
        except Exception:
            continue
        if not result:
            continue
        if not want_ratios:
            return result
        priced = priced or result
        if any(result.get(k) is not None for k in _RATIO_KEYS):
            return result
    return priced


# ── Public API ───────────────────────────────────────────────────────────────


def get_quote(ticker: str) -> dict[str, Any]:
    """Live quote: price, market cap, volume, 52-week range."""
    symbol = ticker.strip().upper()
    data = _walk_providers(symbol, want_ratios=False)
    if not data:
        raise RuntimeError(f"No quote data available for {symbol}")
    return {
        "ticker": symbol,
        "provider": data["provider"],
        "price": data["price"],
        "currency": data.get("currency", "USD"),
        "market_cap": data.get("market_cap"),
        "volume": data.get("volume"),
        "high_52w": data.get("high_52w"),
        "low_52w": data.get("low_52w"),
        "as_of_utc": _utc_stamp(),
    }


def get_ratios(ticker: str) -> dict[str, Any]:
    """Valuation ratios: trailing P/E, dividend yield %, beta."""
    symbol = ticker.strip().upper()
    data = _walk_providers(symbol, want_ratios=True)
    if not data:
        raise RuntimeError(f"No market data available for {symbol}")
    return {
        "ticker": symbol,
        "provider": data["provider"],
        "pe": data.get("pe"),
        "dividend_yield_pct": data.get("dividend_yield_pct"),
        "beta": data.get("beta"),
        "as_of_utc": _utc_stamp(),
    }


# ── CLI ──────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stock Playbook Research — key-free market data fetcher"
    )
    parser.add_argument("ticker", help="Ticker symbol, e.g. AAPL")
    parser.add_argument("--indent", type=int, default=2, help="JSON indent")
    args = parser.parse_args()

    payload = {"quote": get_quote(args.ticker), "ratios": get_ratios(args.ticker)}
    print(json.dumps(payload, indent=args.indent))


if __name__ == "__main__":
    main()
