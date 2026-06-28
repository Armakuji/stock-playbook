import type { Metadata } from "next";
import "./globals.css";
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from "next/font/google";
import { getAllReports } from "@/lib/reports";
import { Header } from "./Header";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "700", "800"],
});

export const metadata: Metadata = {
  title: "Stock Radar Weekly",
  description: "Weekly stock analysis",
};

function getLatestReportDate(): string {
  const reports = getAllReports();
  if (reports.length === 0) return "—";
  const latest = new Date(reports[0].generatedAt);
  const dd = String(latest.getDate()).padStart(2, "0");
  const mm = String(latest.getMonth() + 1).padStart(2, "0");
  const yyyy = latest.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lastUpdated = getLatestReportDate();
  const isLocal = !process.env.VERCEL;
  return (
    <html lang="en" className={`h-full ${bricolage.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <body
        className="min-h-full flex flex-col"
        style={{ backgroundColor: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body, system-ui, sans-serif)" }}
      >
        {/* ── Deep Space ambient layer (fixed, behind everything) ── */}
        <div aria-hidden="true" style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: -1, overflow: "hidden",
        }}>
          {/* Radar sweep — slow rotating conic gradient, the signature effect */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: "220vmax", height: "220vmax",
            transform: "translate(-50%, -50%)",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.022) 18deg, transparent 45deg)",
            animation: "radarSweep 18s linear infinite",
          }} />
          {/* Green origin glow — top center, like the radar source */}
          <div style={{
            position: "absolute", top: "-15%", left: "50%", transform: "translateX(-50%)",
            width: "min(1000px, 130vw)", height: 700,
            background: "radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, transparent 65%)",
          }} />
          {/* Blue glow — bottom right */}
          <div style={{
            position: "absolute", bottom: "-15%", right: "-10%",
            width: 700, height: 600,
            background: "radial-gradient(ellipse at center, rgba(59,130,246,0.055) 0%, transparent 65%)",
          }} />
          {/* Purple accent — mid left */}
          <div style={{
            position: "absolute", top: "35%", left: "-12%",
            width: 500, height: 450,
            background: "radial-gradient(ellipse at center, rgba(139,92,246,0.04) 0%, transparent 65%)",
          }} />
          {/* Warm amber hint — bottom left */}
          <div style={{
            position: "absolute", bottom: "5%", left: "10%",
            width: 350, height: 300,
            background: "radial-gradient(ellipse at center, rgba(245,158,11,0.03) 0%, transparent 65%)",
          }} />
        </div>

        {/* Gradient accent bar — outside header, normal flow, no overflow issues */}
        <div style={{
          height: 3, flexShrink: 0,
          background: "linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6, #f59e0b, #10b981)",
          backgroundSize: "300% 100%",
          animation: "gradientShift 8s linear infinite",
        }} />
        <Header lastUpdated={lastUpdated} isLocal={isLocal} />
        <main style={{ flex: 1, maxWidth: 1200, width: "100%", margin: "0 auto", padding: "24px 16px" }}>
          {children}
        </main>
        <footer style={{ borderTop: "1px solid var(--border)", padding: "16px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Not financial advice · Auto-generated reports
          </p>
        </footer>
      </body>
    </html>
  );
}
