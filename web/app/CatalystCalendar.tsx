"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarEvent } from "@/lib/catalyst-calendar";

const PAGE_SIZE = 5;

function CalPagination({
  page, totalPages, onPrev, onNext,
}: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px",
      borderTop: "1px solid var(--border)",
      marginTop: 4,
    }}>
      <button
        onClick={onPrev}
        disabled={page === 0}
        style={{
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
          border: "1px solid var(--border)",
          background: "transparent",
          color: page === 0 ? "var(--muted)" : "var(--text)",
          cursor: page === 0 ? "default" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: page === 0 ? 0.4 : 1,
          transition: "opacity 0.15s",
        }}
      >
        ← Prev
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
        fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
      }}>
        {page + 1} / {totalPages}
      </span>

      <button
        onClick={onNext}
        disabled={page >= totalPages - 1}
        style={{
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
          border: "1px solid var(--border)",
          background: "transparent",
          color: page >= totalPages - 1 ? "var(--muted)" : "var(--text)",
          cursor: page >= totalPages - 1 ? "default" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: page >= totalPages - 1 ? 0.4 : 1,
          transition: "opacity 0.15s",
        }}
      >
        Next →
      </button>
    </div>
  );
}

const VERDICT_COLORS: Record<string, string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};

function daysUntil(isoDate: string): number {
  const target = new Date(isoDate + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function countdownColor(days: number): string {
  if (days <= 2) return "#ef4444";
  if (days <= 7) return "#f59e0b";
  return "#10b981";
}

function countdownLabel(days: number): string {
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  return `${days}d`;
}

/** Returns true if two events are within 3 calendar days of each other */
function isCluster(a: CalendarEvent, b: CalendarEvent): boolean {
  const diff = Math.abs(
    new Date(a.isoDate).getTime() - new Date(b.isoDate).getTime()
  ) / 86_400_000;
  return diff <= 3;
}

interface RowProps {
  event: CalendarEvent;
  days: number;
  isFirst: boolean;
  isClusterHead: boolean;
  clusterSize: number;
}

function EventRow({ event, days, isFirst, isClusterHead, clusterSize }: RowProps) {
  const [hovered, setHovered] = useState(false);
  const verdictColor = VERDICT_COLORS[event.verdict] ?? "#64748b";
  const cdColor = countdownColor(days);
  const cdLabel = countdownLabel(days);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 16px",
        borderRadius: 10,
        background: hovered ? `${verdictColor}08` : "transparent",
        border: `1px solid ${hovered ? verdictColor + "30" : "transparent"}`,
        transition: "background 0.15s, border-color 0.15s",
        position: "relative",
      }}
    >
      {/* Cluster badge */}
      {isClusterHead && clusterSize > 1 && (
        <span style={{
          position: "absolute", top: -8, left: 56,
          fontSize: 9, fontWeight: 800, padding: "1px 7px", borderRadius: 5,
          background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b40",
          fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px",
        }}>
          {clusterSize} events this week
        </span>
      )}

      {/* Countdown pill */}
      <div style={{
        minWidth: 58, textAlign: "center",
        fontSize: 13, fontWeight: 900,
        color: cdColor,
        fontFamily: "var(--font-mono, monospace)",
        letterSpacing: "-0.3px",
        ...(isFirst ? {
          animation: "spotPulse 2s ease-in-out infinite",
        } : {}),
      }}>
        {cdLabel}
      </div>

      {/* Vertical divider */}
      <div style={{ width: 2, height: 36, borderRadius: 2, background: verdictColor + "60", flexShrink: 0 }} />

      {/* Event info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={`/report/${event.ticker.toLowerCase()}`}
            style={{ textDecoration: "none" }}
          >
            <span style={{
              fontSize: 12, fontWeight: 800, color: verdictColor,
              fontFamily: "var(--font-mono, monospace)",
              textDecoration: "underline",
              textDecorationColor: verdictColor + "55",
              textUnderlineOffset: 3,
            }}>
              {event.ticker}
            </span>
          </Link>
          <span style={{
            fontSize: 12, color: "var(--text)",
            fontFamily: "var(--font-body, sans-serif)",
            fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {event.name}
          </span>
          {event.isEstimate && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
              background: "#3b82f618", color: "#3b82f6", border: "1px dashed #3b82f640",
              fontFamily: "var(--font-mono, monospace)", flexShrink: 0,
            }}>
              est.
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: "var(--muted)", marginTop: 2,
          fontFamily: "var(--font-mono, monospace)",
        }}>
          {event.dateStr} · {event.companyName.split(" ").slice(0, 3).join(" ")}
        </div>
      </div>

      {/* Days bar */}
      <div style={{
        width: 48, height: 4, borderRadius: 2,
        background: "var(--border)",
        overflow: "hidden", flexShrink: 0,
      }}>
        <div style={{
          height: "100%",
          width: `${Math.max(2, 100 - Math.min(days / 90 * 100, 100))}%`,
          background: cdColor,
          borderRadius: 2,
          transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

export function CatalystCalendar({ events }: { events: CalendarEvent[] }) {
  const [days, setDays] = useState<number[]>([]);
  const [page, setPage] = useState(0);

  // Compute days remaining client-side so countdown is always fresh
  useEffect(() => {
    setDays(events.map((e) => daysUntil(e.isoDate)));
  }, [events]);

  if (events.length === 0) return null;

  // Use server-computed fallback until client hydrates
  const daysArr = days.length === events.length
    ? days
    : events.map((e) => daysUntil(e.isoDate));

  // Build cluster groups on full list (preserve cross-page cluster detection)
  const clusterInfo: { isHead: boolean; size: number }[] = events.map(() => ({ isHead: false, size: 1 }));
  let i = 0;
  while (i < events.length) {
    let j = i + 1;
    while (j < events.length && isCluster(events[i], events[j])) j++;
    const size = j - i;
    if (size > 1) {
      clusterInfo[i] = { isHead: true, size };
    }
    i = j;
  }

  const totalPages = Math.ceil(events.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const pageEvents = events.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ marginTop: 48 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <h2 style={{
            fontSize: "clamp(16px, 3vw, 22px)", fontWeight: 900, margin: 0,
            letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)",
          }}>
            Catalyst Calendar
          </h2>
        </div>
        <span style={{
          fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)",
          fontWeight: 700, padding: "3px 9px", borderRadius: 6,
          border: "1px solid var(--border)", background: "var(--card)",
        }}>
          {events.length} events
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px", fontFamily: "var(--font-mono, monospace)" }}>
        Upcoming events across all tracked stocks · <span style={{ color: "#ef4444" }}>red ≤ 2d</span> · <span style={{ color: "#f59e0b" }}>amber ≤ 7d</span> · dashed = estimated date
      </p>

      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "8px 4px 4px",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        {pageEvents.map((event, idx) => {
          const globalIdx = start + idx;
          return (
            <EventRow
              key={`${event.ticker}-${event.isoDate}-${globalIdx}`}
              event={event}
              days={daysArr[globalIdx] ?? 0}
              isFirst={globalIdx === 0}
              isClusterHead={clusterInfo[globalIdx].isHead}
              clusterSize={clusterInfo[globalIdx].size}
            />
          );
        })}

        <CalPagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        />
      </div>
    </div>
  );
}
