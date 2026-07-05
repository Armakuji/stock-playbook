import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateTradeDto } from "./create-trade.dto";

export class UpdateTradeDto extends PartialType(OmitType(CreateTradeDto, ["id"] as const)) {}
