import { IsString, IsOptional, MinLength } from 'class-validator';

export class RejectSubmissionDto {
  @IsString()
  @MinLength(3)
  rejectionReason!: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
