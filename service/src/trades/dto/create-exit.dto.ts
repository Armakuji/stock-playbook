import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateExitDto {
  @IsString()
  date!: string;

  @IsNumber()
  price!: number;

  @IsNumber()
  shares!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
