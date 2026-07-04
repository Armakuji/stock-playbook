import unittest
from typing import Optional
from unittest.mock import patch

from tools import edgar
from tools.edgar import Fact


def _fact(
    concept: str = "Revenues",
    alias_rank: int = 0,
    value: float = 1.0,
    unit: str = "USD",
    form: str = "10-K",
    period_start: Optional[str] = "2025-01-01",
    period_end: str = "2025-12-31",
    filed: Optional[str] = "2026-02-01",
) -> Fact:
    return Fact(
        statement="income_statement",
        field="revenue",
        concept=concept,
        namespace="us-gaap",
        alias_rank=alias_rank,
        value=value,
        unit=unit,
        form=form,
        period_start=period_start,
        period_end=period_end,
        filed=filed,
    )


class ConceptDictionaryTests(unittest.TestCase):
    def test_shares_outstanding_does_not_include_weighted_average_concepts(self) -> None:
        concepts = edgar.STATEMENT_FIELDS["balance_sheet"]["shares_outstanding"]
        self.assertNotIn("WeightedAverageNumberOfDilutedSharesOutstanding", concepts)
        self.assertNotIn("WeightedAverageShares", concepts)


class FactTests(unittest.TestCase):
    def test_quarterly_classification_from_period_span(self) -> None:
        q = _fact(form="10-K", period_start="2026-01-01", period_end="2026-03-31")
        self.assertEqual(q.period_months, 3)
        self.assertTrue(q.is_quarterly)

    def test_annual_classification(self) -> None:
        a = _fact(form="10-K", period_start="2025-04-01", period_end="2026-03-31")
        self.assertEqual(a.period_months, 12)
        self.assertFalse(a.is_quarterly)

    def test_instant_fact_is_not_quarterly_unless_quarterly_form(self) -> None:
        instant = _fact(form="10-K", period_start=None, period_end="2026-03-31")
        self.assertEqual(instant.period_months, 0)
        self.assertFalse(instant.is_quarterly)
        instant_q = _fact(form="10-Q", period_start=None, period_end="2026-03-31")
        self.assertTrue(instant_q.is_quarterly)


class PickLatestTests(unittest.TestCase):
    def test_preferred_alias_beats_recency(self) -> None:
        newer_worse_alias = _fact(
            concept="Revenue", alias_rank=2, period_end="2026-12-31", filed="2027-02-01"
        )
        older_best_alias = _fact(
            concept="Revenues", alias_rank=0, period_end="2025-12-31", filed="2026-02-01"
        )
        best = edgar._pick_latest([newer_worse_alias, older_best_alias])
        assert best is not None
        self.assertEqual(best.concept, "Revenues")

    def test_most_recent_wins_within_same_alias(self) -> None:
        older = _fact(period_end="2024-12-31", filed="2025-02-01", value=1.0)
        newer = _fact(period_end="2025-12-31", filed="2026-02-01", value=2.0)
        best = edgar._pick_latest([older, newer])
        assert best is not None
        self.assertEqual(best.value, 2.0)

    def test_dominant_unit_filters_out_minority_unit(self) -> None:
        usd_a = _fact(unit="USD", period_end="2024-12-31")
        usd_b = _fact(unit="USD", period_end="2025-12-31")
        shares = _fact(unit="shares", period_end="2026-12-31")
        best = edgar._pick_latest([usd_a, usd_b, shares])
        assert best is not None
        self.assertEqual(best.unit, "USD")

    def test_empty_candidates_returns_none(self) -> None:
        self.assertIsNone(edgar._pick_latest([]))


class TickerSpellingTests(unittest.TestCase):
    def test_dotted_ticker_variants(self) -> None:
        self.assertEqual(
            list(edgar._ticker_spellings("BRK.B")), ["BRK.B", "BRK-B", "BRKB", "BRK"]
        )


class FetchRetryTests(unittest.TestCase):
    class FakeResponse:
        def __init__(self, status_code: int, payload: Optional[dict] = None) -> None:
            self.status_code = status_code
            self._payload = payload or {}

        def raise_for_status(self) -> None:
            if self.status_code >= 400:
                raise edgar.requests.HTTPError(response=self)

        def json(self) -> dict:
            return self._payload

    def test_fetch_json_retries_then_succeeds(self) -> None:
        with patch("tools.edgar.requests.get") as get_mock, patch(
            "tools.edgar.time.sleep"
        ) as sleep_mock:
            get_mock.side_effect = [
                self.FakeResponse(503),
                self.FakeResponse(200, {"ok": True}),
            ]
            data = edgar._fetch_json("https://example.com")

        self.assertEqual(data, {"ok": True})
        self.assertEqual(get_mock.call_count, 2)
        sleep_mock.assert_called_once()

    def test_fetch_json_raises_after_max_retries(self) -> None:
        with patch("tools.edgar.requests.get") as get_mock, patch(
            "tools.edgar.time.sleep"
        ):
            get_mock.return_value = self.FakeResponse(503)
            with self.assertRaises(edgar.requests.HTTPError):
                edgar._fetch_json("https://example.com")
        self.assertEqual(get_mock.call_count, edgar.RETRY_ATTEMPTS)


if __name__ == "__main__":
    unittest.main()
