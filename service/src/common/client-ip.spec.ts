import { getClientIp } from "./client-ip";

function makeReq(headers: Record<string, string | string[]>, ip?: string) {
  return { headers, ip } as unknown as Parameters<typeof getClientIp>[0];
}

describe("getClientIp", () => {
  it("prefers the x-vercel-forwarded-for header", () => {
    const req = makeReq(
      { "x-vercel-forwarded-for": "203.0.113.5" },
      "127.0.0.1",
    );
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("takes the first IP when the header contains a comma-separated chain", () => {
    const req = makeReq({
      "x-vercel-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2",
    });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("handles the header arriving as an array (some proxies duplicate headers)", () => {
    const req = makeReq({ "x-vercel-forwarded-for": ["203.0.113.5"] });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("falls back to req.ip when the header is absent (local dev)", () => {
    const req = makeReq({}, "127.0.0.1");
    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("returns null when neither the header nor req.ip is available", () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBeNull();
  });
});
