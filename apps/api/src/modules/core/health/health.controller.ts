import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

import { Public } from '../../../common/decorators/public.decorator';
import { RedisHealthIndicator } from '../redis/redis-health.indicator';

const startedAt = new Date();

@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /**
   * Liveness probe — répond immédiatement si le processus est vivant.
   * Utilisé par les orchestrateurs (Docker, K8s) pour détecter les processus zombies.
   *
   * Enrichi avec la version API et l'uptime pour le monitoring et le debug.
   */
  @Get('health')
  @Version(VERSION_NEUTRAL)
  healthCheck() {
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.0.1',
      uptime: formatUptime(process.uptime()),
      startedAt: startedAt.toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
      memoryUsage: formatMemoryUsage(),
    };
  }

  /**
   * Readiness probe — vérifie que toutes les dépendances sont accessibles.
   * Utilisé par les load-balancers pour savoir si l'instance peut recevoir du trafic.
   */
  @Get('ready')
  @HealthCheck()
  @Version(VERSION_NEUTRAL)
  readyCheck() {
    return this.health.check([
      () => this.database.pingCheck('postgres', { timeout: 1000 }),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}

/**
 * Formate l'uptime en chaîne lisible (ex: "2d 3h 15m 42s").
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Retourne l'utilisation mémoire en format lisible.
 */
function formatMemoryUsage(): { rss: string; heapUsed: string; heapTotal: string } {
  const usage = process.memoryUsage();
  const toMB = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`;

  return {
    rss: toMB(usage.rss),
    heapUsed: toMB(usage.heapUsed),
    heapTotal: toMB(usage.heapTotal),
  };
}
