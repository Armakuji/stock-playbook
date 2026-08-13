"use client";

import { useState } from "react";
import Link from "next/link";
import { RankChange } from "@/lib/ranking-history";
import { StockReport } from "@/lib/types";
import { useLang } from "@/lib/LanguageContext";

const PAGE_SIZE = 5;

function Pagination({
  page, totalPages, onPrev, onNext, th,
}: { page: number; totalPages: number; onPrev: () => void; onNext: () => void; th: boolean }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px",
      borderTop: "1px solid var(--border)",
      background: "var(--card)",
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
    }}>
      <button
        onClick={onPrev}
        disabled={page === 0}
        style={{
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
          border: "1px solid var(--border)",
          background: page === 0 ? "transparent" : "var(--card)",
          color: page === 0 ? "var(--muted)" : "var(--text)",
          cursor: page === 0 ? "default" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: page === 0 ? 0.4 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {th ? "← ก่อนหน้า" : "← Prev"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: totalPages }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === page ? 16 : 6, height: 6, borderRadius: 3,
              background: i === page ? "#10b981" : "var(--border)",
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>

      <span style={{
        fontSize: 10, color: "var(--muted)",
        fontFamily: "var(--font-mono, monospace)",
        fontWeight: 700,
      }}>
        {page + 1} / {totalPages}
      </span>

      <button
        onClick={onNext}
        disabled={page >= totalPages - 1}
        style={{
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
          border: "1px solid var(--border)",
          background: page >= totalPages - 1 ? "transparent" : "var(--card)",
          color: page >= totalPages - 1 ? "var(--muted)" : "var(--text)",
          cursor: page >= totalPages - 1 ? "default" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: page >= totalPages - 1 ? 0.4 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {th ? "ถัดไป →" : "Next →"}
      </button>
    </div>
  );
}

const VERDICT_COLORS: Record<StockReport["verdict"], string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};
const CONFIDENCE_COLORS: Record<string, string> = {
  High: "#10b981", Medium: "#f59e0b", Low: "#ef4444",
};

function DeltaBadge({ delta, th }: { delta: number | null; th: boolean }) {
  if (delta === null) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
        background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630",
        fontFamily: "var(--font-mono, monospace)",
      }}>{th ? "ใหม่" : "NEW"}</span>
    );
  }
  if (delta === 0) {
    return <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>→</span>;
  }
  const up = delta > 0;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
      background: up ? "#10b98118" : "#ef444418",
      color: up ? "#10b981" : "#ef4444",
      border: `1px solid ${up ? "#10b98130" : "#ef444430"}`,
      fontFamily: "var(--font-mono, monospace)",
    }}>
      {up ? `↑${delta}` : `↓${Math.abs(delta)}`}
    </span>
  );
}

export function RankingChangeTable({ rows }: { rows: RankChange[] }) {
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const { lang } = useLang();
  const th = lang === "th";

  if (rows.length === 0) return null;

  // Search matches ticker OR company name, so both "NVDA" and "nvidia" work.
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.ticker.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q)
      )
    : rows;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp rather than trusting `page`: the result set shrinks as you type, and
  // without this you can end up stranded on a page that no longer exists.
  // setPage(0) also fires on every keystroke below — this is the belt-and-braces half.
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>📈</span>
          <h2 style={{
            fontSize: "clamp(16px, 3vw, 22px)", fontWeight: 900, margin: 0,
            letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)",
          }}>
            {th ? "การเปลี่ยนอันดับ" : "Ranking Change"}
          </h2>
        </div>
        <span style={{
          fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)",
          fontWeight: 700, padding: "3px 9px", borderRadius: 6,
          border: "1px solid var(--border)", background: "var(--card)",
        }}>
          {q
            ? th ? `${filtered.length}/${rows.length} หุ้น` : `${filtered.length}/${rows.length} stocks`
            : th ? `${rows.length} หุ้น` : `${rows.length} stocks`}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", fontFamily: "var(--font-mono, monospace)" }}>
        {th
          ? "เทียบกับรายงานครั้งก่อน · ↑ ขึ้นอันดับ · ↓ ลงอันดับ · NEW = ปรากฏครั้งแรก"
          : "vs. previous report snapshot · ↑ moved up · ↓ moved down · NEW = first appearance"}
      </p>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", marginBottom: 16, maxWidth: 320 }}>
        <span style={{
          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          fontSize: 12, color: "var(--muted)", pointerEvents: "none",
        }}>
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          placeholder={th ? "ค้นหาหุ้น หรือ ชื่อบริษัท…" : "Search ticker or company…"}
          aria-label={th ? "ค้นหาหุ้น" : "Search stocks"}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "8px 30px 8px 32px",
            borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--card)", color: "var(--text)",
            fontFamily: "var(--font-mono, monospace)", fontSize: 12, fontWeight: 600,
            outline: "none",
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setPage(0); }}
            aria-label={th ? "ล้างการค้นหา" : "Clear search"}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--muted)", fontSize: 14, lineHeight: 1, padding: 2,
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", minWidth: 640,
            fontFamily: "var(--font-mono, monospace)", fontSize: 12,
          }}>
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {(th
                  ? ["อันดับ", "Δ อันดับ", "หุ้น", "คะแนน", "ความมั่นใจ", "จำนวนสัปดาห์", "TP2 Upside", "เหตุผล", "แหล่งข่าว", ""]
                  : ["Rank", "Δ Rank", "Stock", "Score", "Confidence", "Weeks Listed", "TP2 Upside", "Reason", "Source", ""]
                ).map((h) => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 9, fontWeight: 800, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} style={{
                    padding: "28px 14px", textAlign: "center",
                    color: "var(--muted)", fontSize: 12,
                    fontFamily: "var(--font-mono, monospace)",
                  }}>
                    {th
                      ? `ไม่พบหุ้นที่ตรงกับ “${query}”`
                      : `No stocks match “${query}”`}
                  </td>
                </tr>
              )}
              {pageRows.map((row, idx) => {
                const verdictColor = VERDICT_COLORS[row.verdict] ?? "#64748b";
                const confColor    = CONFIDENCE_COLORS[row.confidence] ?? "#64748b";
                const baseBg       = idx % 2 === 0 ? "transparent" : "#ffffff04";
                const isLast       = idx === pageRows.length - 1;
                return (
                  <tr
                    key={row.ticker}
                    style={{ background: baseBg, borderBottom: !isLast ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = `${verdictColor}08`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = baseBg; }}
                  >
                    <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 13, color: "var(--text)" }}>#{row.currentRank}</td>
                    <td style={{ padding: "12px 14px" }}><DeltaBadge delta={row.delta} th={th} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <Link href={`/report/${row.ticker.toLowerCase()}`} style={{ textDecoration: "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 3, height: 28, borderRadius: 2, background: verdictColor, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: verdictColor, fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.3px", textDecoration: "underline", textDecorationColor: `${verdictColor}55`, textUnderlineOffset: 3 }}>
                              {row.ticker}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1, fontFamily: "var(--font-body, sans-serif)" }}>
                              {row.companyName.split(" ").slice(0, 2).join(" ")}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: verdictColor }}>{row.score}</span>
                      <span style={{ color: "var(--muted)", fontSize: 10 }}>/100</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${confColor}18`, color: confColor, border: `1px solid ${confColor}30` }}>
                        {row.confidence}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 12 }}>{row.weeksInTop10}w</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 800, color: "#10b981", fontSize: 13 }}>+{row.tp2Upside}%</span>
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: 220 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                        {row.reason}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: 200 }}>
                      {row.source ? (
                        <div>
                          <a href={row.source.url} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 11, color: "#3b82f6", textDecoration: "none", lineHeight: 1.4,
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                            fontFamily: "var(--font-body, sans-serif)",
                          }}>
                            {row.source.headline}
                          </a>
                          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, fontFamily: "var(--font-mono, monospace)" }}>
                            {row.source.date}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: "#374151", fontFamily: "var(--font-mono, monospace)", fontStyle: "italic" }}>
                          {th ? "ไม่พบข่าวเฉพาะ — อาจเป็น sector-wide move" : "No specific news found — may be a sector-wide move"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <Link
                        href={`/report/${row.ticker.toLowerCase()}`}
                        style={{
                          fontSize: 11, fontWeight: 800,
                          padding: "4px 10px", borderRadius: 6,
                          background: `${verdictColor}15`,
                          color: verdictColor,
                          border: `1px solid ${verdictColor}35`,
                          textDecoration: "none",
                          fontFamily: "var(--font-mono, monospace)",
                          letterSpacing: "0.3px",
                          display: "inline-block",
                          transition: "background 0.15s",
                        }}
                      >
                        {th ? "ดู →" : "View →"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage(Math.max(0, safePage - 1))}
          onNext={() => setPage(Math.min(totalPages - 1, safePage + 1))}
          th={th}
        />
      </div>
    </div>
  );
}
