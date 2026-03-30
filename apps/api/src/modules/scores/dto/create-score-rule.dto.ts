import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateScoreRuleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  points!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
