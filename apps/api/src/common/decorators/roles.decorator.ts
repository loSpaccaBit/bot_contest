import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Inline the role enum to avoid circular deps; these must match Prisma schema values
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';

export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
