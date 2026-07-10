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

export async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(body.message)) return body.message.join(", ");
  return body.message ?? fallback;
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/journal/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error(await readError(res, `Logout failed (${res.status})`));
  window.location.reload();
}

export function loginUrl(returnTo: string): string {
  return `/api/journal/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}
