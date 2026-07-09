"use client";

import Link from "next/link";
import { useLang } from "@/lib/LanguageContext";

type ActiveTab = "dca" | "catalyst" | "turbo";

const TABS: {
  key: ActiveTab;
  href: string;
  icon: string;
  labelEn: string;
  labelTh: string;
  onClass: string;
}[] = [
  { key: "dca",      href: "/dca",      icon: "💧",  labelEn: "DCA",      labelTh: "DCA",      onClass: "on-water" },
  { key: "catalyst", href: "/catalyst", icon: "🌬️", labelEn: "Catalyst", labelTh: "Catalyst", onClass: "on-air"   },
  { key: "turbo",    href: "/turbo",    icon: "🔥",  labelEn: "Turbo",    labelTh: "Turbo",    onClass: "on-fire"  },
];

export function DashboardSwitcher({
  active,
  counts,
  lastUpdated,
}: {
  active: ActiveTab;
  counts: { dca: number; catalyst: number; turbo: number };
  lastUpdated: string;
}) {
  const { lang } = useLang();
  const th = lang === "th";

  return (
    <div style={{ textAlign: "center", padding: "30px 0 6px" }}>
      {/* ── Mini-hero: LIVE badge + tagline ─────────────────────────── */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14,
        padding: "5px 14px", borderRadius: 999,
        background: "var(--card)", border: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}>
        <span style={{
          display: "inline-block", width: 7, height: 7, borderRadius: "50%",
          background: "#10b981", animation: "livePulse 2s ease-in-out infinite",
        }} />
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px" }}>
          LIVE · {th ? "อัปเดต" : "Updated"} {lastUpdated}
        </span>
      </div>
      <p style={{
        fontSize: 13, color: "var(--muted)", maxWidth: 520, margin: "0 auto 18px",
        fontFamily: "var(--font-mono, monospace)", lineHeight: 1.6,
      }}>
        {th
          ? "เลือกธาตุการลงทุนของคุณด้านล่าง — จัดอันดับใหม่ทุกสัปดาห์"
          : "Pick your investment element below — re-ranked automatically every week."}
      </p>

      {/* ── Cross-route switcher ─────────────────────────────────────── */}
      <div className="radar-pills">
        {TABS.map((t) => {
          const isActive = t.key === active;
          const count = counts[t.key];
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`radar-pill${isActive ? ` ${t.onClass}` : ""}`}
            >
              <span>{t.icon} {th ? t.labelTh : t.labelEn}</span>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 5,
                background: isActive ? "rgba(0,0,0,0.2)" : "#141422",
                color: isActive ? "inherit" : "var(--muted)",
              }}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
