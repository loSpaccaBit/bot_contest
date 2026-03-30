import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateSubmissionFromBotDto {
  @IsString()
  telegramId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  domusbetUsername!: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
