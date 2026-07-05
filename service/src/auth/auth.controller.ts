import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleOAuthClient } from "./google-oauth.client";
import { SessionGuard } from "./session.guard";
import { CurrentUser } from "./current-user.decorator";
import { signSession } from "./session.util";
import { isSafeReturnPath } from "./safe-return-path";

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_RETURN_TO_COOKIE = "oauth_return_to";
const SESSION_COOKIE = "session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_RETURN_PATH = "/journal";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private googleClient(): GoogleOAuthClient {
    // redirect_uri must go through the Next.js rewrite proxy (WEB_ORIGIN), not the
    // API's own origin directly — otherwise Google redirects the browser straight to
    // Railway, the session cookie lands on the Railway host, and the browser never
    // sends it back on subsequent requests to the Vercel-hosted app.
    return new GoogleOAuthClient(
      this.config.get<string>("GOOGLE_CLIENT_ID")!,
      this.config.get<string>("GOOGLE_CLIENT_SECRET")!,
      `${this.config.get<string>("WEB_ORIGIN")}/api/journal/auth/callback`,
    );
  }

  @Get("google")
  google(
    @Query("returnTo") returnTo: string | undefined,
    @Res() res: Response,
  ) {
    const state = randomUUID();
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 5 * 60 * 1000,
    });
    if (isSafeReturnPath(returnTo)) {
      res.cookie(OAUTH_RETURN_TO_COOKIE, returnTo, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 5 * 60 * 1000,
      });
    }
    res.redirect(this.googleClient().generateAuthUrl(state));
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code || !state || state !== req.cookies?.[OAUTH_STATE_COOKIE]) {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    const profile = await this.googleClient().exchangeCodeForProfile(code);
    const user = await this.authService.findOrCreateUserFromGoogle(profile);
    const token = signSession(
      { userId: user.id },
      this.config.get<string>("SESSION_SECRET")!,
    );

    const returnTo = req.cookies?.[OAUTH_RETURN_TO_COOKIE] as
      string | undefined;
    const returnPath = isSafeReturnPath(returnTo)
      ? returnTo
      : DEFAULT_RETURN_PATH;

    res.clearCookie(OAUTH_STATE_COOKIE);
    res.clearCookie(OAUTH_RETURN_TO_COOKIE);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: THIRTY_DAYS_MS,
    });
    res.redirect(`${this.config.get<string>("WEB_ORIGIN")}${returnPath}`);
  }

  @Get("me")
  @UseGuards(SessionGuard)
  async me(@CurrentUser() userId: string) {
    const user = await this.authService.getById(userId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    };
  }

  @Post("logout")
  logout(@Res() res: Response) {
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  }
}
