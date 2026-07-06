import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ValidationService } from "./validation.service";

@Controller("journal")
@UseGuards(SessionGuard)
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  @Post("validate")
  async validate(@CurrentUser() userId: string) {
    return this.validation.validate(userId);
  }

  @Get("validate/quota")
  async quota(@CurrentUser() userId: string) {
    return this.validation.getQuota(userId);
  }
}
