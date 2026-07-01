import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

import { RedisHealthIndicator } from '../redis/redis-health.indicator';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let health: jest.Mocked<HealthCheckService>;
  let healthCheckMock: jest.Mock;
  let database: jest.Mocked<TypeOrmHealthIndicator>;
  let redis: jest.Mocked<RedisHealthIndicator>;

  beforeEach(async () => {
    healthCheckMock = jest.fn().mockResolvedValue({
      details: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
      },
      error: {},
      info: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
      },
      status: 'ok',
    });

    health = {
      check: healthCheckMock,
    } as unknown as jest.Mocked<HealthCheckService>;

    database = {
      pingCheck: jest.fn().mockResolvedValue({ postgres: { status: 'up' } }),
    } as unknown as jest.Mocked<TypeOrmHealthIndicator>;

    redis = {
      pingCheck: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
    } as unknown as jest.Mocked<RedisHealthIndicator>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: TypeOrmHealthIndicator, useValue: database },
        { provide: RedisHealthIndicator, useValue: redis },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns liveness status with enriched metadata', () => {
    const result = controller.healthCheck();

    expect(result.status).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect(typeof result.uptime).toBe('string');
    expect(typeof result.startedAt).toBe('string');
    expect(typeof result.environment).toBe('string');
    expect(result.memoryUsage.rss).toMatch(/^\d+MB$/);
    expect(result.memoryUsage.heapUsed).toMatch(/^\d+MB$/);
    expect(result.memoryUsage.heapTotal).toMatch(/^\d+MB$/);
  });

  it('returns readiness status when PostgreSQL and Redis are up', async () => {
    await expect(controller.readyCheck()).resolves.toMatchObject({
      status: 'ok',
      info: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
      },
    });
    expect(healthCheckMock).toHaveBeenCalledWith([expect.any(Function), expect.any(Function)]);
  });

  it('propagates readiness failure when PostgreSQL is down', async () => {
    healthCheckMock.mockRejectedValueOnce(new Error('PostgreSQL is down'));

    await expect(controller.readyCheck()).rejects.toThrow('PostgreSQL is down');
  });
});
