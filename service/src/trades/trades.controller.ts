import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { TradesService } from "./trades.service";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { UpdateTradeDto } from "./dto/update-trade.dto";
import { CreateExitDto } from "./dto/create-exit.dto";

@Controller("trades")
@UseGuards(SessionGuard)
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.trades.findAll(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() userId: string) {
    return this.trades.findOne(id, userId);
  }

  @Post()
  create(@Body() dto: CreateTradeDto, @CurrentUser() userId: string) {
    return this.trades.create(userId, dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTradeDto, @CurrentUser() userId: string) {
    return this.trades.update(id, userId, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() userId: string) {
    await this.trades.remove(id, userId);
    return { ok: true };
  }

  @Post(":id/exits")
  addExit(@Param("id") id: string, @Body() dto: CreateExitDto, @CurrentUser() userId: string) {
    return this.trades.addExit(id, userId, dto);
  }
}
