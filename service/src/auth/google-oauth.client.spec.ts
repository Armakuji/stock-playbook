import { GoogleOAuthClient } from "./google-oauth.client";

describe("GoogleOAuthClient.generateAuthUrl", () => {
  it("builds a Google auth URL with the expected client id, redirect_uri, scope and state", () => {
    const client = new GoogleOAuthClient("client-id-123", "client-secret", "http://localhost:4000/auth/callback");
    const url = new URL(client.generateAuthUrl("state-abc"));

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-id-123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4000/auth/callback");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("state")).toBe("state-abc");
  });
});
