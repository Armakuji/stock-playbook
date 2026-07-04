import { signSession, verifySession } from "./session.util";

describe("session.util", () => {
  const secret = "test-secret";

  it("round-trips a valid session token", () => {
    const token = signSession({ userId: "user-123" }, secret);
    const payload = verifySession(token, secret);
    expect(payload.userId).toBe("user-123");
  });

  it("throws when the secret doesn't match", () => {
    const token = signSession({ userId: "user-123" }, secret);
    expect(() => verifySession(token, "wrong-secret")).toThrow();
  });

  it("throws on a malformed token", () => {
    expect(() => verifySession("not-a-jwt", secret)).toThrow();
  });
});
