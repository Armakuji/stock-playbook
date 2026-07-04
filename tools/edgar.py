#!/usr/bin/env python3
"""SEC EDGAR fundamentals fetcher — Stock Radar Research.

Pulls company facts (XBRL) and filing metadata straight from the free SEC
EDGAR API and normalizes them into the compact snapshot the Stock Radar
report skills consume. No API key required.

Public functions (stable API — referenced by references/edgar-guide.md):
- get_cik(ticker)               -> zero-padded CIK string or None
- get_company_facts(ticker)     -> raw XBRL companyfacts payload + metadata
- get_financials(ticker)        -> normalized annual + quarterly snapshots
- get_filings_metadata(ticker)  -> recent 10-K/10-Q/20-F/6-K filings

CLI:
    python3 tools/edgar.py AAPL
    python3 tools/edgar.py NVDA --mode filings
    python3 tools/edgar.py ASML --mode facts
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Callable, Iterator, Optional

import requests

# ── HTTP layer ───────────────────────────────────────────────────────────────

USER_AGENT = "stock-radar-weekly/1.0 (nitipon.ching@gmail.com)"

CIK_LOOKUP_URL = "https://www.sec.gov/files/company_tickers.json"
COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"

REQUEST_TIMEOUT = 25
RETRY_ATTEMPTS = 3
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


def _fetch_json(url: str) -> dict[str, Any]:
    """GET a JSON document with exponential backoff on transient failures."""
    delay = 1.0
    for attempt in range(RETRY_ATTEMPTS):
        try:
            resp = requests.get(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code in RETRY_STATUSES:
                raise requests.HTTPError(f"transient {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError):
            if attempt == RETRY_ATTEMPTS - 1:
                raise
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


# ── Concept dictionary ───────────────────────────────────────────────────────
# Each field lists accepted XBRL concept tags, best-first (US-GAAP then IFRS
# aliases). The first alias that has data for the requested period wins.

STATEMENT_FIELDS: dict[str, dict[str, tuple[str, ...]]] = {
    "income_statement": {
        "revenue": (
            "Revenues",
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "Revenue",
            "RevenueFromContractsWithCustomers",
            "RevenueFromRenderingOfServices",
        ),
        "gross_profit": ("GrossProfit",),
        "operating_income": ("OperatingIncomeLoss", "ProfitLossFromOperatingActivities"),
        "net_income": (
            "NetIncomeLoss",
            "ProfitLoss",
            "ProfitLossAttributableToOwnersOfParent",
        ),
        "eps_diluted": ("EarningsPerShareDiluted", "DilutedEarningsLossPerShare"),
        "eps_basic": (
            "EarningsPerShareBasic",
            "BasicEarningsLossPerShare",
            "BasicAndDilutedEarningsLossPerShare",
        ),
        "r_and_d": ("ResearchAndDevelopmentExpense",),
        "sga": (
            "SellingGeneralAndAdministrativeExpense",
            "GeneralAndAdministrativeExpense",
        ),
        "interest_expense": (
            "InterestExpense",
            "FinanceCosts",
            "BorrowingCostsRecognisedAsExpense",
        ),
        "income_tax_expense": ("IncomeTaxExpenseBenefit",),
    },
    "balance_sheet": {
        "total_assets": ("Assets",),
        "current_assets": ("AssetsCurrent", "CurrentAssets"),
        "current_liabilities": ("LiabilitiesCurrent", "CurrentLiabilities"),
        "total_liabilities": ("Liabilities",),
        "stockholders_equity": ("StockholdersEquity", "Equity"),
        "cash_and_equivalents": (
            "CashAndCashEquivalentsAtCarryingValue",
            "CashAndCashEquivalents",
        ),
        "long_term_debt": ("LongTermDebt", "LongTermDebtNoncurrent", "LongtermBorrowings"),
        "short_term_borrowings": (
            "ShortTermBorrowings",
            "CurrentPortionOfLongtermBorrowings",
        ),
        "shares_outstanding": (
            "CommonStockSharesOutstanding",
            "EntityCommonStockSharesOutstanding",
            "NumberOfSharesIssued",
            "ShareIssued",
            "OrdinarySharesNumber",
        ),
    },
    "cash_flow": {
        "operating_cash_flow": (
            "NetCashProvidedByOperatingActivities",
            "OperatingCashFlow",
            "CashFlowsFromUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivities",
        ),
        "capex": (
            "PaymentsToAcquirePropertyPlantAndEquipment",
            "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
        ),
        "depreciation_amortization": (
            "DepreciationDepletionAndAmortization",
            "Depreciation",
            "DepreciationAndAmortization",
            "DepreciationExpense",
        ),
        "stock_based_compensation": (
            "StockBasedCompensation",
            "ShareBasedCompensation",
            "AdjustmentsForSharebasedPayments",
        ),
        "dividends_paid": (
            "DividendsCommonStockCash",
            "DividendsPaid",
            "DividendsPaidOrdinarySharesPerShare",
        ),
    },
}

XBRL_NAMESPACES = ("us-gaap", "ifrs-full")
REPORT_FORMS = frozenset({"10-K", "10-Q", "20-F", "6-K"})
ANNUAL_FORMS = frozenset({"10-K", "20-F"})
QUARTERLY_FORMS = frozenset({"10-Q", "6-K"})


# ── Data model ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Fact:
    """One reported XBRL value for a (statement, field)."""

    statement: str
    field: str
    concept: str
    namespace: str
    alias_rank: int  # position of concept in the alias tuple (0 = best)
    value: float
    unit: str
    form: str
    period_start: Optional[str]
    period_end: str
    filed: Optional[str]

    @property
    def period_months(self) -> Optional[int]:
        """Approximate covered period length: 0 = instant, 3/6/9/12 = duration."""
        if not self.period_start:
            return 0
        try:
            start = date.fromisoformat(self.period_start)
            end = date.fromisoformat(self.period_end)
        except ValueError:
            return None
        span = (end - start).days
        if span <= 0:
            return 0
        for months, ceiling in ((3, 120), (6, 210), (9, 310)):
            if span <= ceiling:
                return months
        return 12

    @property
    def is_quarterly(self) -> bool:
        if self.form in QUARTERLY_FORMS:
            return True
        months = self.period_months
        return months is not None and 1 <= months <= 4


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _as_float(value: Any) -> Optional[float]:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


# ── Ticker → CIK ─────────────────────────────────────────────────────────────


def _ticker_spellings(ticker: str) -> Iterator[str]:
    """Yield plausible SEC spellings of a ticker (BRK.B ↔ BRK-B ↔ BRKB …)."""
    base = ticker.strip().upper()
    seen: set[str] = set()
    for candidate in (
        base,
        base.replace(".", "-"),
        base.replace("-", "."),
        base.replace(".", ""),
        base.split(".")[0],
        base.split("-")[0],
    ):
        if candidate and candidate not in seen:
            seen.add(candidate)
            yield candidate


def get_cik(ticker: str) -> Optional[str]:
    """Resolve a ticker symbol to its zero-padded 10-digit SEC CIK."""
    table = _fetch_json(CIK_LOOKUP_URL)
    by_symbol = {
        str(row["ticker"]).upper(): str(row["cik_str"]).zfill(10)
        for row in table.values()
        if isinstance(row, dict) and row.get("ticker") and row.get("cik_str") is not None
    }
    return next(
        (by_symbol[s] for s in _ticker_spellings(ticker) if s in by_symbol), None
    )


def _require_cik(ticker: str) -> tuple[str, str]:
    symbol = ticker.strip().upper()
    cik = get_cik(symbol)
    if not cik:
        raise ValueError(f"CIK not found for ticker: {symbol}")
    return symbol, cik


# ── Public fetchers ──────────────────────────────────────────────────────────


def get_company_facts(ticker: str) -> dict[str, Any]:
    """Fetch the raw EDGAR companyfacts (XBRL) payload for a ticker."""
    symbol, cik = _require_cik(ticker)
    payload = _fetch_json(COMPANY_FACTS_URL.format(cik=cik))
    return {
        "ticker": symbol,
        "cik": cik,
        "entity_name": payload.get("entityName", symbol),
        "facts": payload.get("facts", {}),
        "raw": payload,
        "retrieved_utc": _utc_stamp(),
    }


def get_filings_metadata(ticker: str, limit: int = 10) -> list[dict[str, Any]]:
    """List recent periodic-report filings (10-K / 10-Q / 20-F / 6-K)."""
    symbol, cik = _require_cik(ticker)
    recent = _fetch_json(SUBMISSIONS_URL.format(cik=cik)).get("filings", {}).get(
        "recent", {}
    )

    def column(name: str) -> list[Any]:
        return recent.get(name, [])

    rows = []
    for form, filed, report, accession, doc in zip(
        column("form"),
        column("filingDate"),
        column("reportDate"),
        column("accessionNumber"),
        column("primaryDocument"),
    ):
        if form not in REPORT_FORMS:
            continue
        rows.append(
            {
                "form": form,
                "filing_date": filed or None,
                "report_date": report or None,
                "accession_number": accession or None,
                "primary_document": doc or None,
            }
        )
        if len(rows) >= limit:
            break
    return rows


# ── Snapshot builder ─────────────────────────────────────────────────────────


def _iter_facts(company_facts: dict[str, Any]) -> Iterator[Fact]:
    """Walk the XBRL tree and yield every mapped, usable fact."""
    tree = company_facts.get("facts", {})
    for namespace in XBRL_NAMESPACES:
        concepts = tree.get(namespace)
        if not isinstance(concepts, dict):
            continue
        for statement, fields in STATEMENT_FIELDS.items():
            for field, aliases in fields.items():
                for rank, concept in enumerate(aliases):
                    units = concepts.get(concept, {}).get("units", {})
                    if not isinstance(units, dict):
                        continue
                    for unit, entries in units.items():
                        for entry in entries:
                            if entry.get("form") not in REPORT_FORMS:
                                continue
                            value = _as_float(entry.get("val"))
                            end = entry.get("end")
                            if value is None or not end:
                                continue
                            yield Fact(
                                statement=statement,
                                field=field,
                                concept=concept,
                                namespace=namespace,
                                alias_rank=rank,
                                value=value,
                                unit=unit,
                                form=entry.get("form", ""),
                                period_start=entry.get("start"),
                                period_end=end,
                                filed=entry.get("filed"),
                            )


def _pick_latest(candidates: list[Fact]) -> Optional[Fact]:
    """Best fact for one field: preferred alias first, then most recent."""
    if not candidates:
        return None
    top_rank = min(f.alias_rank for f in candidates)
    pool = [f for f in candidates if f.alias_rank == top_rank]
    # Keep the dominant unit so mixed USD/share counts never blend.
    unit_tally: dict[str, int] = {}
    for f in pool:
        unit_tally[f.unit] = unit_tally.get(f.unit, 0) + 1
    dominant_unit = max(unit_tally, key=unit_tally.get)  # type: ignore[arg-type]
    pool = [f for f in pool if f.unit == dominant_unit]
    return max(pool, key=lambda f: (f.period_end, f.filed or ""))


def _snapshot(facts: list[Fact], quarterly: bool) -> dict[str, Any]:
    """Assemble one period-scope snapshot (annual or quarterly)."""
    statements: dict[str, dict[str, float]] = {s: {} for s in STATEMENT_FIELDS}
    sources: dict[str, dict[str, Any]] = {}
    latest_period: Optional[str] = None

    buckets: dict[tuple[str, str], list[Fact]] = {}
    for f in facts:
        in_scope = f.is_quarterly if quarterly else (
            not f.is_quarterly and f.form in ANNUAL_FORMS
        )
        if in_scope:
            buckets.setdefault((f.statement, f.field), []).append(f)

    for (statement, field), candidates in buckets.items():
        best = _pick_latest(candidates)
        if not best:
            continue
        statements[statement][field] = best.value
        sources[f"{statement}.{field}"] = {
            "form": best.form,
            "filed": best.filed,
            "period_end": best.period_end,
            "unit": best.unit,
            "concept": best.concept,
            "namespace": best.namespace,
        }
        if latest_period is None or best.period_end > latest_period:
            latest_period = best.period_end

    return {"period_end": latest_period, "statements": statements, "sources": sources}


def get_financials(ticker: str) -> dict[str, Any]:
    """Return normalized annual + quarterly financial snapshots for a ticker."""
    company = get_company_facts(ticker)
    facts = list(_iter_facts(company))
    return {
        "ticker": company["ticker"],
        "cik": company["cik"],
        "entity_name": company["entity_name"],
        "annual": _snapshot(facts, quarterly=False),
        "quarterly": _snapshot(facts, quarterly=True),
        "retrieved_utc": _utc_stamp(),
    }


# ── CLI ──────────────────────────────────────────────────────────────────────


def _mode_financials(ticker: str) -> dict[str, Any]:
    return get_financials(ticker)


def _mode_facts(ticker: str) -> dict[str, Any]:
    facts = get_company_facts(ticker)
    return {
        "ticker": facts["ticker"],
        "cik": facts["cik"],
        "entity_name": facts["entity_name"],
        "namespaces": sorted(facts.get("facts", {}).keys()),
        "retrieved_utc": facts["retrieved_utc"],
    }


def _mode_filings(ticker: str) -> dict[str, Any]:
    return {
        "ticker": ticker.strip().upper(),
        "filings": get_filings_metadata(ticker),
        "retrieved_utc": _utc_stamp(),
    }


MODES: dict[str, Callable[[str], dict[str, Any]]] = {
    "financials": _mode_financials,
    "facts": _mode_facts,
    "filings": _mode_filings,
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stock Radar Research — SEC EDGAR fundamentals fetcher"
    )
    parser.add_argument("ticker", help="Ticker symbol, e.g. AAPL")
    parser.add_argument("--mode", default="financials", choices=sorted(MODES))
    parser.add_argument("--indent", type=int, default=2, help="JSON indent")
    args = parser.parse_args()

    print(json.dumps(MODES[args.mode](args.ticker), indent=args.indent))


if __name__ == "__main__":
    main()
