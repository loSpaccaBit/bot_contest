import { IsString, IsOptional } from 'class-validator';

export class ApproveSubmissionDto {
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @IsOptional()
  @IsString()
  scoreRuleId?: string;
}
