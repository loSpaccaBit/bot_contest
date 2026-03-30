import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AdminRole } from '../decorators/roles.decorator';
import { AdminJwtPayload } from '../types/request.types';

// Role hierarchy: SUPER_ADMIN > ADMIN > VIEWER
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  VIEWER: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles required — allow through (JWT guard handles authentication)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AdminJwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userRoleLevel = ROLE_HIERARCHY[user.role as AdminRole] ?? 0;

    // User must have at least the level of one of the required roles
    const minRequiredLevel = Math.min(
      ...requiredRoles.map((r) => ROLE_HIERARCHY[r] ?? Infinity),
    );

    if (userRoleLevel < minRequiredLevel) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
