import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class AssignPointsDto {
  @IsString()
  scoreRuleCode!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  customPoints?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
