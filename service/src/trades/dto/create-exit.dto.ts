import { IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateExitDto {
  @IsString()
  date!: string;

  @IsNumber()
  price!: number;

  @IsNumber()
  @IsPositive()
  shares!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
