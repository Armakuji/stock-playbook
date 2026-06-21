"use client";

import { useEffect, useRef, useState } from "react";
import { TimelinePoint } from "@/lib/timeline";

interface Props {
  points: TimelinePoint[];
  ticker: string;
}

function fmt(date: string): string {
  // YYYYMMDD → "Jun 21"
  const y = date.slice(0, 4);
  const m = parseInt(date.slice(4, 6), 10) - 1;
  const d = parseInt(date.slice(6, 8), 10);
  return new Date(parseInt(y), m, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface SparklineProps {
  points: number[];
  color: string;
  invert?: boolean;        // rank axis: lower = better = top
  width: number;
  height: number;
  animated: boolean;
  onHover: (idx: number | null) => void;
  hoverIdx: number | null;
  label: string;
  formatVal: (v: number) => string;
  allPoints: TimelinePoint[];
}

function Sparkline({
  points, color, invert, width, height, animated,
  onHover, hoverIdx, label, formatVal, allPoints,
}: SparklineProps) {
  const n = points.length;
  if (n === 0) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const pad = { top: 10, bottom: 10, left: 8, right: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  function xOf(i: number) {
    return pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  }
  function yOf(v: number) {
    const norm = (v - min) / range;
    const y = invert ? norm : 1 - norm;
    return pad.top + y * innerH;
  }

  const pts = points.map((v, i) => [xOf(i), yOf(v)] as [number, number]);

  // Build smooth path
  function buildPath(pts: [number, number][]) {
    if (pts.length === 1) {
      return `M ${pts[0][0]} ${pts[0][1]}`;
    }
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
    }
    return d;
  }

  const pathD = buildPath(pts);
  const pathId = `line-${label.replace(/\s/g, "")}`;
  const gradId = `grad-${label.replace(/\s/g, "")}`;
  const clipId = `clip-${label.replace(/\s/g, "")}-${Math.random().toString(36).slice(2)}`;

  // Fill area under line
  const fillD = n > 1
    ? `${pathD} L ${pts[n - 1][0]} ${pad.top + innerH} L ${pts[0][0]} ${pad.top + innerH} Z`
    : "";

  const isUp = n > 1 && points[n - 1] >= points[0];

  return (
    <div style={{ position: "relative" }}>
      <svg
        width={width}
        height={height}
        style={{ overflow: "visible", display: "block" }}
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
          {animated && (
            <clipPath id={clipId}>
              <rect x="0" y="0" height={height} width={width}>
                <animate attributeName="width" from="0" to={width} dur="0.7s" fill="freeze" />
              </rect>
            </clipPath>
          )}
        </defs>

        {/* Fill */}
        {fillD && (
          <path
            d={fillD}
            fill={`url(#${gradId})`}
            clipPath={animated ? `url(#${clipId})` : undefined}
          />
        )}

        {/* Line */}
        <path
          id={pathId}
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={animated ? `url(#${clipId})` : undefined}
        />

        {/* Data points */}
        {pts.map(([x, y], i) => {
          const isLast = i === n - 1;
          const isHovered = hoverIdx === i;
          return (
            <g key={i} onMouseEnter={() => onHover(i)} style={{ cursor: "pointer" }}>
              {/* Hit area */}
              <circle cx={x} cy={y} r={14} fill="transparent" />
              {/* Dot */}
              <circle
                cx={x} cy={y}
                r={isLast ? 5 : isHovered ? 4 : 3}
                fill={isLast || isHovered ? color : "var(--bg, #0f172a)"}
                stroke={color}
                strokeWidth={isLast ? 2.5 : 1.5}
                style={{ transition: "r 0.15s" }}
              />
              {/* Pulse on last point */}
              {isLast && (
                <circle cx={x} cy={y} r={8} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4}>
                  <animate attributeName="r" values="6;11;6" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function StockTimeline({ points, ticker }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimated(true); },
      { threshold: 0.3 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (points.length === 0) return null;

  const scores  = points.map((p) => p.score);
  const targets = points.map((p) => p.targetPrice);
  const ranks   = points.map((p) => p.rank);

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  const latest  = points[points.length - 1];
  const prev    = points.length > 1 ? points[points.length - 2] : null;

  function delta(curr: number, last: number, invert = false) {
    const d = curr - last;
    if (d === 0) return null;
    const up = invert ? d < 0 : d > 0;
    return { d, up, text: (d > 0 ? "+" : "") + d.toFixed(invert ? 0 : 1) };
  }

  const scoreDelta  = prev ? delta(latest.score, prev.score) : null;
  const targetDelta = prev ? delta(latest.targetPrice, prev.targetPrice) : null;
  const rankDelta   = prev ? delta(latest.rank, prev.rank, true) : null;  // lower rank = better

  const isSingle = points.length === 1;

  const sparkH = 72;
  // Each sparkline is in a 1/3 column with 12px gaps and 28px padding per cell
  const sparkW = Math.max(Math.floor((width - 24) / 3) - 28, 60);

  const metrics: { label: string; color: string; value: string; delta: ReturnType<typeof delta>; invert?: boolean; vals: number[]; formatVal: (v: number) => string }[] = [
    {
      label: "Score",
      color: "#3b82f6",
      value: `${latest.score}`,
      delta: scoreDelta,
      vals: scores,
      formatVal: (v) => `${v}`,
    },
    {
      label: "TP2 Target",
      color: "#10b981",
      value: `$${latest.targetPrice}`,
      delta: targetDelta,
      vals: targets,
      formatVal: (v) => `$${v}`,
    },
    {
      label: "Rank",
      color: "#8b5cf6",
      value: `#${latest.rank}`,
      delta: rankDelta,
      invert: true,
      vals: ranks,
      formatVal: (v) => `#${v}`,
    },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "20px 22px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "1.5px",
            color: "var(--muted)", textTransform: "uppercase",
            fontFamily: "var(--font-mono, monospace)", marginBottom: 4,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>📈</span> Stock Timeline
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            {points.length} snapshot{points.length !== 1 ? "s" : ""} · {fmt(points[0].date)}
            {points.length > 1 ? ` → ${fmt(latest.date)}` : ""}
          </div>
        </div>
        {isSingle && (
          <span style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 6,
            background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630",
            fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
          }}>
            First snapshot — check back next week
          </span>
        )}
      </div>

      {/* Three sparklines side by side */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
      }}>
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              background: "var(--card-elevated, #0f172a)",
              borderRadius: 10, padding: "14px 14px 10px",
              border: `1px solid ${m.color}30`,
            }}
          >
            {/* Metric header */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)" }}>
                {m.label}
              </div>
              {m.delta && (
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: m.delta.up ? "#10b981" : "#ef4444",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  {m.delta.up ? "▲" : "▼"} {Math.abs(m.delta.d).toFixed(m.label === "Rank" ? 0 : m.label === "TP2 Target" ? 0 : 0)}
                </span>
              )}
            </div>

            {/* Current value */}
            <div style={{
              fontSize: 20, fontWeight: 900,
              color: m.color,
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "-0.5px",
              marginBottom: 8,
            }}>
              {hovered ? m.formatVal(m.vals[hoverIdx!]) : m.value}
            </div>

            {/* Sparkline */}
            <Sparkline
              points={m.vals}
              color={m.color}
              invert={m.invert}
              width={sparkW}
              height={sparkH}
              animated={animated}
              onHover={setHoverIdx}
              hoverIdx={hoverIdx}
              label={m.label}
              formatVal={m.formatVal}
              allPoints={points}
            />

            {/* Date ticks */}
            <div style={{
              display: "flex",
              justifyContent: points.length > 1 ? "space-between" : "center",
              marginTop: 6,
            }}>
              {points.length > 1 ? (
                <>
                  <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{fmt(points[0].date)}</span>
                  <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{fmt(latest.date)}</span>
                </>
              ) : (
                <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{fmt(points[0].date)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Hover tooltip bar */}
      {hovered && (
        <div style={{
          marginTop: 14,
          padding: "10px 14px",
          borderRadius: 8,
          background: "var(--bg, #0f172a)",
          border: "1px solid var(--border-bright, #334155)",
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 16,
          animation: "fadeInUp 0.15s ease-out",
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            {fmt(hovered.date)}
          </span>
          <span style={{ fontSize: 11, color: "#3b82f6", fontFamily: "var(--font-mono, monospace)" }}>
            Score <strong>{hovered.score}</strong>
          </span>
          <span style={{ fontSize: 11, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>
            Target <strong>${hovered.targetPrice}</strong>
          </span>
          <span style={{ fontSize: 11, color: "#8b5cf6", fontFamily: "var(--font-mono, monospace)" }}>
            Rank <strong>#{hovered.rank}</strong>
          </span>
          {hovered.rankChangeHeadline && (
            <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-body, sans-serif)", fontStyle: "italic", maxWidth: 300 }}>
              {hovered.rankChangeUrl ? (
                <a href={hovered.rankChangeUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#3b82f6", textDecoration: "none" }}>
                  {hovered.rankChangeHeadline}
                </a>
              ) : hovered.rankChangeHeadline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
