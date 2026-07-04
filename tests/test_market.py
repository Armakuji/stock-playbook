import unittest
from typing import Any, Optional
from unittest.mock import patch

from tools import market


def _quote(provider: str, **overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "provider": provider,
        "price": 100.0,
        "currency": "USD",
        "market_cap": None,
        "volume": None,
        "high_52w": None,
        "low_52w": None,
        "pe": None,
        "dividend_yield_pct": None,
        "beta": None,
    }
    base.update(overrides)
    return base


class ProviderChainTests(unittest.TestCase):
    def test_get_ratios_short_circuits_after_first_provider_with_ratios(self) -> None:
        calls: list[str] = []

        def yahoo(_t: str):
            calls.append("yahoo")
            return _quote("yahoo", pe=25.0, dividend_yield_pct=1.2, beta=1.1)

        def finviz(_t: str):
            calls.append("finviz")
            return _quote("finviz", pe=18.0)

        with patch.object(market, "PROVIDER_CHAIN", (yahoo, finviz)):
            result = market.get_ratios("AAPL")

        self.assertEqual(result["provider"], "yahoo")
        self.assertEqual(calls, ["yahoo"])

    def test_get_ratios_uses_second_provider_when_first_has_no_ratios(self) -> None:
        calls: list[str] = []

        def yahoo(_t: str):
            calls.append("yahoo")
            return _quote("yahoo")  # priced but no ratios

        def finviz(_t: str):
            calls.append("finviz")
            return _quote("finviz", pe=18.0, dividend_yield_pct=2.0, beta=0.9)

        def stooq(_t: str):
            calls.append("stooq")
            return None

        with patch.object(market, "PROVIDER_CHAIN", (yahoo, finviz, stooq)):
            result = market.get_ratios("AAPL")

        self.assertEqual(result["provider"], "finviz")
        self.assertEqual(calls, ["yahoo", "finviz"])

    def test_get_ratios_falls_back_to_first_priced_provider(self) -> None:
        def yahoo(_t: str):
            return _quote("yahoo")  # priced, no ratios

        def finviz(_t: str):
            return None  # nothing

        with patch.object(market, "PROVIDER_CHAIN", (yahoo, finviz)):
            result = market.get_ratios("AAPL")

        self.assertEqual(result["provider"], "yahoo")

    def test_get_quote_skips_provider_that_raises(self) -> None:
        def yahoo(_t: str):
            raise RuntimeError("boom")

        def finviz(_t: str):
            return _quote("finviz", market_cap=1e9)

        with patch.object(market, "PROVIDER_CHAIN", (yahoo, finviz)):
            result = market.get_quote("AAPL")

        self.assertEqual(result["provider"], "finviz")
        self.assertEqual(result["market_cap"], 1e9)

    def test_get_quote_raises_when_all_providers_fail(self) -> None:
        with patch.object(market, "PROVIDER_CHAIN", (lambda _t: None,)):
            with self.assertRaises(RuntimeError):
                market.get_quote("AAPL")


class ParsingTests(unittest.TestCase):
    def test_compact_numbers(self) -> None:
        self.assertEqual(market._num_compact("1.2B"), 1.2e9)
        self.assertEqual(market._num_compact("$45.30"), 45.3)
        self.assertEqual(market._num_compact("3,400"), 3400.0)
        self.assertIsNone(market._num_compact("N/A"))
        self.assertIsNone(market._num_compact(""))

    def test_percent(self) -> None:
        self.assertEqual(market._num_percent("2.5%"), 2.5)
        self.assertIsNone(market._num_percent("N/A"))


class RetryTests(unittest.TestCase):
    class FakeResponse:
        def __init__(self, status_code: int, payload: Optional[dict] = None) -> None:
            self.status_code = status_code
            self._payload = payload or {}

        def raise_for_status(self) -> None:
            if self.status_code >= 400:
                raise market.requests.HTTPError(response=self)

        def json(self) -> dict:
            return self._payload

    def test_http_get_retries_then_succeeds(self) -> None:
        with patch("tools.market.requests.get") as get_mock, patch(
            "tools.market.time.sleep"
        ) as sleep_mock:
            get_mock.side_effect = [
                self.FakeResponse(503),
                self.FakeResponse(200, {"ok": True}),
            ]
            resp = market._http_get("https://example.com")

        self.assertEqual(resp.json(), {"ok": True})
        self.assertEqual(get_mock.call_count, 2)
        sleep_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
