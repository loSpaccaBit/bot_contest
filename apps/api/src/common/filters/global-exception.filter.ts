import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@domusbet/database';
import { ZodError } from 'zod';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request.url);

    const statusCode = this.getStatusCode(exception);

    this.logError(exception, request, statusCode);

    response.status(statusCode).json(errorResponse);
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return HttpStatus.CONFLICT;
      if (exception.code === 'P2025') return HttpStatus.NOT_FOUND;
      if (exception.code === 'P2003') return HttpStatus.BAD_REQUEST;
    }

    if (exception instanceof ZodError) {
      return HttpStatus.BAD_REQUEST;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private buildErrorResponse(exception: unknown, path: string): ErrorResponse {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let details: unknown;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) ?? exception.message;
        if (Array.isArray(resp['message'])) {
          message = 'Validation failed';
          details = this.isDevelopment ? resp['message'] : undefined;
        }
      } else {
        message = String(exceptionResponse);
      }

      return {
        success: false,
        error: {
          code: this.getHttpErrorCode(status),
          message,
          ...(details !== undefined && { details }),
        },
        timestamp,
        path,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = (exception.meta?.['target'] as string[])?.join(', ');
        return {
          success: false,
          error: {
            code: 'UNIQUE_CONSTRAINT_VIOLATION',
            message: `A record with this ${target ?? 'value'} already exists`,
            ...(this.isDevelopment && { details: exception.meta }),
          },
          timestamp,
          path,
        };
      }

      if (exception.code === 'P2025') {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'The requested record was not found',
            ...(this.isDevelopment && { details: exception.meta }),
          },
          timestamp,
          path,
        };
      }

      if (exception.code === 'P2003') {
        return {
          success: false,
          error: {
            code: 'FOREIGN_KEY_CONSTRAINT',
            message: 'Related record not found',
            ...(this.isDevelopment && { details: exception.meta }),
          },
          timestamp,
          path,
        };
      }
    }

    if (exception instanceof ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: this.isDevelopment ? exception.errors : undefined,
        },
        timestamp,
        path,
      };
    }

    // Unknown/unhandled error - never leak details in production
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        ...(this.isDevelopment && {
          details: {
            name: (exception as Error)?.name,
            message: (exception as Error)?.message,
            stack: (exception as Error)?.stack,
          },
        }),
      },
      timestamp,
      path,
    };
  }

  private getHttpErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      408: 'REQUEST_TIMEOUT',
      409: 'CONFLICT',
      410: 'GONE',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codes[status] ?? 'HTTP_ERROR';
  }

  private logError(exception: unknown, request: Request, statusCode: number): void {
    const context = {
      method: request.method,
      url: request.url,
      statusCode,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };

    if (statusCode >= 500) {
      this.logger.error(
        `[${context.method}] ${context.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
        context,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `[${context.method}] ${context.url} → ${statusCode}`,
        context,
      );
    }
  }
}
