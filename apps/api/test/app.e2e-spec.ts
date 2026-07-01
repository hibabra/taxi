import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from './../src/app.module';

describe('Core health endpoints (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.enableVersioning({
      defaultVersion: '1',
      type: VersioningType.URI,
    });
    app.setGlobalPrefix('api', { exclude: ['health', 'ready'] });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/ready')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: 'ok',
          info: {
            postgres: { status: 'up' },
            redis: { status: 'up' },
          },
        });
      });
  });

  it('/api/v1/auth/me requires an access token', () => {
    return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('/api/v1/auth/login rate limits brute force attempts', async () => {
    const credentials = {
      email: 'missing@taxikiwi.local',
      password: 'WrongPassword123!',
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer()).post('/api/v1/auth/login').send(credentials).expect(401);
    }

    await request(app.getHttpServer()).post('/api/v1/auth/login').send(credentials).expect(429);
  });

  afterAll(async () => {
    await app.close();
  });
});
