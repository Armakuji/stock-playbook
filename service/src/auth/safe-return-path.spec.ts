import { isSafeReturnPath } from "./safe-return-path";

describe("isSafeReturnPath", () => {
  it("accepts a plain relative path", () => {
    expect(isSafeReturnPath("/journal")).toBe(true);
    expect(isSafeReturnPath("/catalyst")).toBe(true);
    expect(isSafeReturnPath("/")).toBe(true);
  });

  it("rejects a protocol-relative URL (open-redirect via //evil.com)", () => {
    expect(isSafeReturnPath("//evil.com")).toBe(false);
    expect(isSafeReturnPath("//evil.com/journal")).toBe(false);
  });

  it("rejects absolute URLs to another origin", () => {
    expect(isSafeReturnPath("http://evil.com")).toBe(false);
    expect(isSafeReturnPath("https://evil.com/journal")).toBe(false);
  });

  it("rejects a path that embeds a scheme after the leading slash", () => {
    expect(isSafeReturnPath("/https://evil.com")).toBe(false);
  });

  it("rejects non-string, missing, or empty values", () => {
    expect(isSafeReturnPath(undefined)).toBe(false);
    expect(isSafeReturnPath(null)).toBe(false);
    expect(isSafeReturnPath("")).toBe(false);
    expect(isSafeReturnPath(["/journal"])).toBe(false);
  });

  it("rejects a path that doesn't start with a slash", () => {
    expect(isSafeReturnPath("journal")).toBe(false);
  });
});
