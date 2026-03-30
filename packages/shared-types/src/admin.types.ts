import type { AdminRole } from './enums';
import type { PaginationQuery } from './pagination.types';

export interface LoginDto {
  email: string;
  password: string;
}

export interface TokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface AdminDto {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminDto {
  email: string;
  password: string;
  displayName: string;
  role?: AdminRole;
}

export interface UpdateAdminDto {
  email?: string;
  displayName?: string;
  role?: AdminRole;
  isActive?: boolean;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AdminFiltersDto extends PaginationQuery {
  role?: AdminRole;
  isActive?: boolean;
  search?: string;
}

export interface AuthenticatedAdminDto extends AdminDto {
  tokens: TokensDto;
}
