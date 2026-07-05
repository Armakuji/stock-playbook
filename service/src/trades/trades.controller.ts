import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { TradesService } from "./trades.service";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { UpdateTradeDto } from "./dto/update-trade.dto";
import { CreateExitDto } from "./dto/create-exit.dto";
import { serializeTrade } from "./serialize-trade";

@Controller("trades")
@UseGuards(SessionGuard)
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Get()
  async findAll(@CurrentUser() userId: string) {
    const trades = await this.trades.findAll(userId);
    return trades.map(serializeTrade);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @CurrentUser() userId: string) {
    return serializeTrade(await this.trades.findOne(id, userId));
  }

  @Post()
  async create(@Body() dto: CreateTradeDto, @CurrentUser() userId: string) {
    return serializeTrade(await this.trades.create(userId, dto));
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateTradeDto, @CurrentUser() userId: string) {
    return serializeTrade(await this.trades.update(id, userId, dto));
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() userId: string) {
    await this.trades.remove(id, userId);
    return { ok: true };
  }

  @Post(":id/exits")
  async addExit(@Param("id") id: string, @Body() dto: CreateExitDto, @CurrentUser() userId: string) {
    return serializeTrade(await this.trades.addExit(id, userId, dto));
  }
}
