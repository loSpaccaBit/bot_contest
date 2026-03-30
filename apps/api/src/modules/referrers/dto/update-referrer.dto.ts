import {
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class UpdateReferrerDto {
  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
