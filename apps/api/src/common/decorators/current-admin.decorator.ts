import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminJwtPayload } from '../types/request.types';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AdminJwtPayload;
  },
);
