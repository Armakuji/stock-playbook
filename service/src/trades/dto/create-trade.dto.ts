import { IsArray, IsNumber, IsOptional, IsString, ArrayMinSize, ArrayMaxSize } from "class-validator";

export class CreateTradeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  ticker!: string;

  @IsString()
  catalystType!: string;

  @IsOptional()
  @IsString()
  linkedReportDate?: string;

  @IsNumber()
  entryPrice!: number;

  @IsNumber()
  shares!: number;

  @IsString()
  entryDate!: string;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({}, { each: true })
  plannedTP!: number[];

  @IsNumber()
  plannedSL!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
