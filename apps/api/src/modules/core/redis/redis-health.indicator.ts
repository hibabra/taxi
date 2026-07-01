import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck<Key extends string>(key: Key): Promise<HealthIndicatorResult<Key>> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const response = await withTimeout(this.redis.ping(), 1000);

      if (response !== 'PONG') {
        throw new Error('Unexpected Redis PING response');
      }

      return indicator.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis ping failed';
      const result = indicator.down({ message });

      throw new HealthCheckError('Redis health check failed', result);
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Redis ping timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
