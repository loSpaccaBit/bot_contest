import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AdminJwtPayload } from '../types/request.types';

/**
 * Lightweight interceptor that attaches request metadata to the request object
 * so that services can access it when creating audit logs.
 *
 * Actual audit log creation is done inside the services.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AdminJwtPayload; auditMeta?: { ipAddress: string; userAgent: string } }
    >();

    // Attach metadata for services to pick up
    request.auditMeta = {
      ipAddress: request.ip ?? request.socket?.remoteAddress ?? 'unknown',
      userAgent: request.get('user-agent') ?? 'unknown',
    };

    return next.handle().pipe(
      tap(() => {
        // Could emit events here if needed
      }),
    );
  }
}
