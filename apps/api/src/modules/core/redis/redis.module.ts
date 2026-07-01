import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';

import { REDIS_CLIENT } from './redis.constants';
import { RedisClientService } from './redis-client.service';
import { RedisHealthIndicator } from './redis-health.indicator';

@Module({
  imports: [
    TerminusModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: parseRedisConnection(configService.getOrThrow<string>('redis.url')),
        prefix: configService.getOrThrow<string>('redis.bullPrefix'),
      }),
    }),
  ],
  providers: [
    RedisClientService,
    {
      provide: REDIS_CLIENT,
      inject: [RedisClientService],
      useFactory: (redisClientService: RedisClientService) => redisClientService.client,
    },
    RedisHealthIndicator,
  ],
  exports: [BullModule, REDIS_CLIENT, RedisClientService, RedisHealthIndicator],
})
export class RedisModule {}

function parseRedisConnection(redisUrl: string) {
  const url = new URL(redisUrl);

  return {
    db: url.pathname ? Number(url.pathname.replace('/', '')) || 0 : 0,
    host: url.hostname,
    password: url.password || undefined,
    port: Number(url.port || 6379),
    tls: url.protocol === 'rediss:' ? {} : undefined,
    username: url.username || undefined,
  };
}
