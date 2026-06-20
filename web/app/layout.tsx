import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Radar Weekly",
  description: "Weekly stock analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Auto-updated weekly</span>
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
