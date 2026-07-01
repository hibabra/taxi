import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: true,
    }),
    { bufferLogs: true },
  );
  const configService = app.get(ConfigService);

  app.useLogger(app.get(Logger));

  await app.register(fastifyCookie, {
    secret: configService.getOrThrow<string>('cookie.secret'),
  });

  app.enableCors({
    credentials: true,
    origin: configService.getOrThrow<string[]>('corsOrigins'),
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy:
      configService.getOrThrow<string>('env') === 'production' ? undefined : false,
  });

  app.enableVersioning({
    defaultVersion: '1',
    type: VersioningType.URI,
  });
  app.setGlobalPrefix('api', { exclude: ['health', 'ready'] });

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  if (configService.getOrThrow<boolean>('swagger.enabled')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TaxiKiwi API')
      .setDescription('TaxiKiwi backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(configService.getOrThrow<string>('swagger.path'), app, swaggerDocument);
  }

  app.enableShutdownHooks();

  await app.listen({
    host: configService.getOrThrow<string>('host'),
    port: configService.getOrThrow<number>('port'),
  });
}

void bootstrap();
