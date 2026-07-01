import path from 'node:path';

import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

import { configuration } from '../config/configuration';

export function createTypeOrmOptions(configService: ConfigService): TypeOrmModuleOptions {
  return {
    ...createDataSourceOptions({
      databaseUrl: configService.getOrThrow<string>('database.url'),
      poolMax: configService.getOrThrow<number>('database.poolMax'),
      connectionTimeoutMs: configService.getOrThrow<number>('database.connectionTimeoutMs'),
      queryTimeoutMs: configService.getOrThrow<number>('database.queryTimeoutMs'),
      ssl: configService.getOrThrow<boolean>('database.ssl'),
      sslRejectUnauthorized: configService.getOrThrow<boolean>('database.sslRejectUnauthorized'),
      logging: configService.getOrThrow<boolean>('database.logging'),
    }),
    autoLoadEntities: true,
  };
}

export function createDataSourceOptions(
  options: {
    databaseUrl?: string;
    poolMax?: number;
    connectionTimeoutMs?: number;
    queryTimeoutMs?: number;
    ssl?: boolean;
    sslRejectUnauthorized?: boolean;
    logging?: boolean;
  } = {},
): DataSourceOptions {
  const appConfig = configuration();
  const databaseUrl = options.databaseUrl ?? appConfig.database.url;
  const ssl = options.ssl ?? appConfig.database.ssl;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create the TypeORM data source');
  }

  const typeScriptRuntime = isTypeScriptRuntime();

  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [
      path.join(process.cwd(), typeScriptRuntime ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'),
    ],
    migrations: [
      path.join(process.cwd(), typeScriptRuntime ? 'src/migrations/*.ts' : 'dist/migrations/*.js'),
    ],
    migrationsRun: false,
    synchronize: false,
    logging: options.logging ?? appConfig.database.logging,
    ssl: ssl
      ? {
          rejectUnauthorized:
            options.sslRejectUnauthorized ?? appConfig.database.sslRejectUnauthorized,
        }
      : false,
    extra: {
      application_name: 'taxikiwi-api',
      connectionTimeoutMillis:
        options.connectionTimeoutMs ?? appConfig.database.connectionTimeoutMs,
      max: options.poolMax ?? appConfig.database.poolMax,
      min: appConfig.database.poolMin,
      query_timeout: options.queryTimeoutMs ?? appConfig.database.queryTimeoutMs,
      statement_timeout: options.queryTimeoutMs ?? appConfig.database.queryTimeoutMs,
    },
  };
}

function isTypeScriptRuntime(): boolean {
  return (
    process.argv.some((arg) => arg.includes('ts-node') || arg.includes('typeorm-ts-node')) ||
    process.execArgv.some((arg) => arg.includes('ts-node')) ||
    Boolean(process.env.TS_NODE_DEV)
  );
}
