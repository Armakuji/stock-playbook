import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SessionGuard } from "./session.guard";
import { signSession } from "./session.util";

interface FakeRequest {
  cookies: Record<string, string>;
  userId?: string;
}

function fakeContext(cookies: Record<string, string>): ExecutionContext {
  const req: FakeRequest = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe("SessionGuard", () => {
  const secret = "test-secret";
  const config = { get: () => secret } as unknown as ConfigService;
  const guard = new SessionGuard(config);

  it("allows a request with a valid session cookie and sets req.userId", () => {
    const token = signSession({ userId: "user-123" }, secret);
    const ctx = fakeContext({ session: token });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest<FakeRequest>().userId).toBe(
      "user-123",
    );
  });

  it("rejects a request with no session cookie", () => {
    expect(() => guard.canActivate(fakeContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a request with a tampered session cookie", () => {
    expect(() =>
      guard.canActivate(fakeContext({ session: "garbage" })),
    ).toThrow(UnauthorizedException);
  });
});
