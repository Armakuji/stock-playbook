import { test } from "node:test";
import assert from "node:assert/strict";
import { stopHit, partitionStopped } from "../lib/stop-status.ts";

const rep = (over = {}) => ({
  ticker: "ABC",
  price: 10,
  generatedAt: "2026-11-01T00:00:00.000Z",
  entryStrategy: { stopLoss: { tight: 8.5, hard: 7 } },
  ...over,
});
const quote = (price, asOf = "2026-11-11T16:00:00.000Z") => ({ ABC: { price, asOf } });

test("STOPPED when the live price is at or below the hard stop", () => {
  const hit = stopHit(rep(), quote(6.9));
  assert.ok(hit);
  assert.equal(hit.hardStop, 7);
  assert.equal(hit.movePct, -31);
  assert.ok(stopHit(rep(), quote(7)));
});

test("tight-stop breach alone is not STOPPED", () => {
  assert.equal(stopHit(rep(), quote(8)), null);
});

test("a quote older than the report never stops it (report rewritten after the drop)", () => {
  assert.equal(stopHit(rep({ generatedAt: "2026-11-12T00:00:00.000Z" }), quote(5)), null);
});

test("missing quote or missing hard stop → not stopped", () => {
  assert.equal(stopHit(rep(), {}), null);
  assert.equal(stopHit(rep({ entryStrategy: { stopLoss: {} } }), quote(1)), null);
});

test("partitionStopped splits active vs stopped, worst move first", () => {
  const a = rep({ ticker: "A" });
  const b = rep({ ticker: "B" });
  const c = rep({ ticker: "C" });
  const live = {
    A: { price: 6, asOf: "2026-11-11T16:00:00.000Z" },
    B: { price: 9, asOf: "2026-11-11T16:00:00.000Z" },
    C: { price: 3, asOf: "2026-11-11T16:00:00.000Z" },
  };
  const { active, stopped } = partitionStopped([a, b, c], live);
  assert.deepEqual(active.map((r) => r.ticker), ["B"]);
  assert.deepEqual(stopped.map((s) => s.ticker), ["C", "A"]);
});
