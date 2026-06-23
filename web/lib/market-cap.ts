// ─── market-cap.ts — size-tier badge from the marketCap string ──────────────
// CLIENT-SAFE pure helper. Parses "$1.89T" / "$30.7B" / "$540M" → a size tier
// so each report can show SMALL / MID / LARGE / MEGA cap at a glance.
// Derived from marketCap (no extra hand-set field) → reproducible.

export interface CapTier {
  label: string;   // badge text, e.g. "MEGA CAP"
  short: string;   // compact form, e.g. "MEGA"
  color: string;
  bg: string;
}

/** Parse a market-cap string into a number of billions of USD. */
export function parseMarketCapB(mc?: string): number | null {
  if (!mc) return null;
  const m = mc.replace(/[,$\s]/g, "").match(/^([\d.]+)([TBMK]?)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const unit = (m[2] || "B").toUpperCase();
  const mult = unit === "T" ? 1000 : unit === "B" ? 1 : unit === "M" ? 1 / 1000 : unit === "K" ? 1 / 1e6 : 1;
  return n * mult; // billions
}

/**
 * Map a market-cap string to a size tier.
 *  MEGA  ≥ $200B · LARGE $10–200B · MID $2–10B · SMALL < $2B
 */
export function marketCapTier(mc?: string): CapTier | null {
  const b = parseMarketCapB(mc);
  if (b == null) return null;
  if (b >= 200) return { label: "MEGA CAP",  short: "MEGA",  color: "#8b5cf6", bg: "#8b5cf61c" };
  if (b >= 10)  return { label: "LARGE CAP", short: "LARGE", color: "#10b981", bg: "#10b9811c" };
  if (b >= 2)   return { label: "MID CAP",   short: "MID",   color: "#3b82f6", bg: "#3b82f61c" };
  return          { label: "SMALL CAP", short: "SMALL", color: "#f59e0b", bg: "#f59e0b1c" };
}
