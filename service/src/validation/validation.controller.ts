import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { getClientIp } from "../common/client-ip";
import { ValidationService } from "./validation.service";

@Controller("journal")
@UseGuards(SessionGuard)
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  @Post("validate")
  async validate(@CurrentUser() userId: string, @Req() req: Request) {
    return this.validation.validate(userId, getClientIp(req));
  }

  @Get("validate/quota")
  async quota(@CurrentUser() userId: string) {
    return this.validation.getQuota(userId);
  }
}
