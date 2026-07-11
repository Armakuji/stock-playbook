"use client";

import { useLang } from "@/lib/LanguageContext";

export function Footer() {
  const { lang } = useLang();
  const th = lang === "th";

  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "16px 24px", textAlign: "center" }}>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>
        Not financial advice · Auto-generated reports
      </p>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
        <a
          href="mailto:armakuji@hotmail.com"
          style={{
            fontSize: 12, color: "var(--muted)", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <span aria-hidden="true">✉</span> {th ? "ติดต่อ" : "Contact"}
        </a>
        <a
          href="https://github.com/Armakuji"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12, color: "var(--muted)", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <span aria-hidden="true">{"</>"}</span> GitHub
        </a>
      </div>
    </footer>
  );
}
