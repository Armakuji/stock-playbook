import Link from "next/link";

export function LoginGate() {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, fontFamily: "var(--font-display, sans-serif)" }}>
        Trade Journal
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, fontFamily: "var(--font-mono, monospace)" }}>
        Log in with Google to view and manage your trades.
      </p>
      <Link
        href="/api/journal/auth/google"
        style={{
          display: "inline-block", padding: "10px 20px", borderRadius: 8,
          background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 13,
          textDecoration: "none", fontFamily: "var(--font-mono, monospace)",
        }}
      >
        Log in with Google
      </Link>
    </div>
  );
}
