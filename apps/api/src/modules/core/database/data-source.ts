import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { createDataSourceOptions } from './typeorm.config';

for (const envFile of [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env.local'),
  path.resolve(process.cwd(), '../../.env'),
]) {
  loadEnv({ path: envFile, override: false, quiet: true });
}

export default new DataSource(createDataSourceOptions());
