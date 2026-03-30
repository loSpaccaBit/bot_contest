import { IsString, IsBoolean, IsArray, IsOptional, ValidateNested, IsNumber, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TextPositionDto {
  @IsNumber()
  rank!: number;

  @IsNumber()
  @Min(0)
  x!: number;

  @IsNumber()
  @Min(0)
  y!: number;

  @IsNumber()
  @Min(6)
  fontSize!: number;

  @IsString()
  color!: string;

  @IsBoolean()
  bold!: boolean;

  @IsIn(['left', 'center', 'right'])
  align!: 'left' | 'center' | 'right';

  @IsOptional()
  @IsString()
  fontFamily?: string;
}

export class UpdateLeaderboardTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TextPositionDto)
  positions?: TextPositionDto[];
}
