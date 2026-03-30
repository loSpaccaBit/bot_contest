import type { AuditAction } from './enums';
import type { PaginationQuery } from './pagination.types';

export interface AuditLogDto {
  id: string;
  adminId?: string | null;
  adminDisplayName?: string | null;
  adminEmail?: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface AuditLogFiltersDto extends PaginationQuery {
  adminId?: string;
  action?: AuditAction | string;
  entityType?: string;
  entityId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
}

export interface CreateAuditLogDto {
  adminId?: string;
  action: AuditAction | string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
