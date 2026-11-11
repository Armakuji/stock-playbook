// Run: cd web && npm test   (node:test + built-in type stripping, no deps)
//
// Bangkok on purpose: the date helpers used to build dates from LOCAL
// midnight, which reads as "yesterday" east of UTC. These tests pin the UTC
// behaviour so that bug can't come back.
process.env.TZ = "Asia/Bangkok";

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDateStr, catalystISO, proximityISO, isFuzzyBadge,
  todayISO, addDaysUTC, daysBetweenISO, nextCatalyst, reportStage,
} from "../lib/catalyst-timing.ts";

const report = (catalysts = [], estimateDates = []) => ({ catalysts, estimateDates });

test("parseDateStr: exact day, month, quarter, half", () => {
  assert.equal(parseDateStr("Nov 22, 2026"), "2026-11-22");
  assert.equal(parseDateStr("Nov 22 2026"), "2026-11-22");
  // Fuzzy grammar still parses to a mid-period day — this is the phantom date
  // the validator blocks on new reports (see scripts/validate-reports.mjs).
  assert.equal(parseDateStr("Dec 2026"), "2026-12-15");
  assert.equal(parseDateStr("Q4 2026"), "2026-11-15"); // mid-quarter month
  assert.equal(parseDateStr("H2 2026"), "2026-09-15"); // mid-half month
});

test("parseDateStr: ~ prefix and free text never parse", () => {
  assert.equal(parseDateStr("~Q4 2026"), null);
  assert.equal(parseDateStr("~Nov 2026"), null);
  assert.equal(parseDateStr("Ongoing"), null);
  assert.equal(parseDateStr("Pending"), null);
  assert.equal(parseDateStr(undefined), null);
});

test("catalystISO prefers explicit catalystDate over the badge", () => {
  assert.equal(catalystISO({ name: "x", dateBadge: "Q4 2026", catalystDate: "2026-12-31" }), "2026-12-31");
  assert.equal(catalystISO({ name: "x", dateBadge: "Nov 22, 2026" }), "2026-11-22");
});

test("fuzzy (~) catalysts are kept out of proximity but still mark the window end", () => {
  const fuzzy = { name: "QSOC launch", dateBadge: "~Q4 2026", catalystDate: "2026-12-31" };
  assert.equal(isFuzzyBadge(fuzzy.dateBadge), true);
  assert.equal(proximityISO(fuzzy), null);
  const r = report([fuzzy]);
  assert.equal(nextCatalyst(r, "2026-11-12"), null);        // no proximity day
  assert.equal(reportStage(r, "2026-11-12"), "pre");        // window still open
  assert.equal(reportStage(r, "2027-01-02"), "post");       // window closed
});

test("nextCatalyst picks the soonest real day", () => {
  const r = report(
    [{ name: "PDUFA", dateBadge: "Nov 22, 2026", catalystDate: "2026-11-22" }],
    [{ event: "Earnings", dateRange: "Nov 18, 2026" }],
  );
  const n = nextCatalyst(r, "2026-11-12");
  assert.equal(n.iso, "2026-11-18");
  assert.equal(n.days, 6);
});

test("reportStage: undated / pre / post", () => {
  assert.equal(reportStage(report([{ name: "x", dateBadge: "Ongoing" }]), "2026-11-12"), "undated");
  assert.equal(reportStage(report([{ name: "x", catalystDate: "2026-11-12" }]), "2026-11-12"), "pre");
  assert.equal(reportStage(report([{ name: "x", catalystDate: "2026-11-11" }]), "2026-11-12"), "post");
});

test("UTC date math is timezone-independent (runs under Asia/Bangkok)", () => {
  assert.equal(todayISO(), new Date().toISOString().slice(0, 10));
  assert.equal(addDaysUTC("20261111", 14), "2026-11-25");
  assert.equal(addDaysUTC("20261231", 1), "2027-01-01");
  assert.equal(addDaysUTC("20260301", -1), "2026-02-28");
  assert.equal(daysBetweenISO("2026-11-11", "2026-11-25"), 14);
});
