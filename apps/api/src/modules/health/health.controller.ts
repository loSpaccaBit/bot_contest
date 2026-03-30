import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  environment: string;
}

@Controller('health')
export class HealthController {
  /**
   * GET /api/health
   *
   * Public endpoint used by Docker healthchecks, load-balancers, and uptime
   * monitoring services. Returns a lightweight JSON payload — no database
   * queries are performed so the check is always fast and dependency-free.
   */
  @Public()
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
