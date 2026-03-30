import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class InternalApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers['x-internal-secret'];

    const expectedSecret = process.env['API_INTERNAL_SECRET'];

    if (!expectedSecret) {
      throw new UnauthorizedException('Internal API secret not configured');
    }

    if (!secret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing internal API secret');
    }

    return true;
  }
}
