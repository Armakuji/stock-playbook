import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifySession } from "./session.util";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.session;
    if (!token) throw new UnauthorizedException("Not logged in");
    try {
      const payload = verifySession(token, this.config.get<string>("SESSION_SECRET")!);
      req.userId = payload.userId;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid session");
    }
  }
}
