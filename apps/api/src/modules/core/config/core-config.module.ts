import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from './configuration';
import { validationSchema } from './validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
      isGlobal: true,
      load: [configuration],
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
      validationSchema,
    }),
  ],
  exports: [ConfigModule],
})
export class CoreConfigModule {}
