import type { Metadata } from "next";
import "./globals.css";
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from "next/font/google";
import { getAllReports } from "@/lib/reports";

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
  return (
    <html lang="en" className={`h-full ${bricolage.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <body
        className="min-h-full flex flex-col"
        style={{ backgroundColor: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body, system-ui, sans-serif)" }}
      >
        <header style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)", position: "relative" }}>
          {/* Animated gradient accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: "linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6, #f59e0b, #10b981)",
            backgroundSize: "300% 100%",
            animation: "gradientShift 8s linear infinite",
          }} />
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
                📡 Stock Radar Weekly
              </span>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "livePulse 2s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>Updated {lastUpdated}</span>
            </div>
          </div>
        </header>
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
