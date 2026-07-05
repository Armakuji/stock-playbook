import { OAuth2Client } from "google-auth-library";
import { GoogleProfile } from "./auth.service";

export class GoogleOAuthClient {
  private readonly client: OAuth2Client;

  constructor(
    private readonly clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) {
    this.client = new OAuth2Client({ clientId, clientSecret, redirectUri });
  }

  generateAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      scope: ["openid", "email", "profile"],
      state,
    });
  }

  async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    const { tokens } = await this.client.getToken(code);
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: this.clientId,
    });
    const payload = ticket.getPayload()!;
    return {
      sub: payload.sub,
      email: payload.email!,
      emailVerified: !!payload.email_verified,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
