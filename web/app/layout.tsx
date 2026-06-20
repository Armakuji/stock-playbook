import type { Metadata } from "next";
import "./globals.css";
import { getAllReports } from "@/lib/reports";

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
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>
        <header style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text)" }}>
                📡 Stock Radar Weekly
              </span>
            </a>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Updated {lastUpdated}</span>
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
