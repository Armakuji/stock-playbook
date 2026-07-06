import { Module } from "@nestjs/common";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { ClaudeClient } from "./claude.client";

@Module({
  controllers: [ValidationController],
  providers: [ValidationService, ClaudeClient],
})
export class ValidationModule {}
