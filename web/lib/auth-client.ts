// ─── Journal auth — client-side helpers ──────────────────────────────────────
// Shared by Header.tsx (site-wide auth widget) and JournalContent.tsx, so both
// talk to the Journal API the same way instead of duplicating fetch/error logic.

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch("/api/journal/auth/me");
  if (!res.ok) return null;
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/journal/auth/logout", { method: "POST" });
  window.location.reload();
}

export function loginUrl(returnTo: string): string {
  return `/api/journal/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}
