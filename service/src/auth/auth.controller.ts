import { Controller, Get, Post, Query, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleOAuthClient } from "./google-oauth.client";
import { SessionGuard } from "./session.guard";
import { CurrentUser } from "./current-user.decorator";
import { signSession } from "./session.util";

const OAUTH_STATE_COOKIE = "oauth_state";
const SESSION_COOKIE = "session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private googleClient(): GoogleOAuthClient {
    return new GoogleOAuthClient(
      this.config.get<string>("GOOGLE_CLIENT_ID")!,
      this.config.get<string>("GOOGLE_CLIENT_SECRET")!,
      `${this.config.get<string>("API_ORIGIN")}/auth/callback`,
    );
  }

  @Get("google")
  google(@Res() res: Response) {
    const state = randomUUID();
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 5 * 60 * 1000,
    });
    res.redirect(this.googleClient().generateAuthUrl(state));
  }

  @Get("callback")
  async callback(@Query("code") code: string, @Query("state") state: string, @Req() req: Request, @Res() res: Response) {
    if (!code || !state || state !== req.cookies?.[OAUTH_STATE_COOKIE]) {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    const profile = await this.googleClient().exchangeCodeForProfile(code);
    const user = await this.authService.findOrCreateUserFromGoogle(profile);
    const token = signSession({ userId: user.id }, this.config.get<string>("SESSION_SECRET")!);

    res.clearCookie(OAUTH_STATE_COOKIE);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: THIRTY_DAYS_MS,
    });
    res.redirect(`${this.config.get<string>("WEB_ORIGIN")}/journal`);
  }

  @Get("me")
  @UseGuards(SessionGuard)
  async me(@CurrentUser() userId: string) {
    const user = await this.authService.getById(userId);
    return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
  }

  @Post("logout")
  logout(@Res() res: Response) {
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  }
}
