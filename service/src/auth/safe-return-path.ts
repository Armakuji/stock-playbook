// Only accept a same-origin relative path for the post-login redirect — never let
// a caller-supplied returnTo value redirect off the web app's own origin
// (open-redirect via "//evil.com", "http://evil.com", "https://evil.com", etc.).
export function isSafeReturnPath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}
