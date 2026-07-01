import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { CoreConfigModule } from './config/core-config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    CoreConfigModule,
    LoggerModule.forRootAsync({
      imports: [CoreConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment = configService.getOrThrow<string>('env') === 'development';

        return {
          pinoHttp: {
            autoLogging: {
              ignore: (request) => ['/health', '/ready'].includes(request.url ?? ''),
            },
            customErrorMessage: (request, response, error) =>
              `${request.method} ${request.url} -> ${response.statusCode} ${error.message}`,
            customSuccessMessage: (request, response, responseTime) =>
              `${request.method} ${request.url} -> ${response.statusCode} ${Math.round(responseTime)}ms`,
            genReqId: (request) => request.headers['x-request-id']?.toString() ?? randomUUID(),
            level: configService.getOrThrow<string>('log.level'),
            transport: isDevelopment
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    ignore: 'pid,hostname,req,res,responseTime,err',
                    singleLine: true,
                    translateTime: 'HH:MM:ss',
                  },
                }
              : undefined,
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'password',
              'passwordHash',
              '*.password',
              '*.passwordHash',
            ],
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [CoreConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.getOrThrow<number>('throttling.ttlMs'),
          limit: configService.getOrThrow<number>('throttling.limit'),
        },
      ],
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
  ],
  exports: [
    CoreConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    LoggerModule,
    ThrottlerModule,
  ],
})
export class CoreModule {}
