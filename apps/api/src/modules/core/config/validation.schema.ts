import Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  APP_ENV: Joi.string().valid('local', 'test', 'staging', 'production').default('local'),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent')
    .default('info'),

  PORT: Joi.number().port().default(3000),
  API_PORT: Joi.number().port().default(3000),
  API_HOST: Joi.string().hostname().default('0.0.0.0'),
  ADMIN_ORIGIN: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3001'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  DATABASE_SSL: Joi.boolean().default(false),
  DATABASE_SSL_REJECT_UNAUTHORIZED: Joi.boolean().default(true),
  DB_POOL_MIN: Joi.number().integer().min(0).default(2),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),
  DB_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
  DB_QUERY_TIMEOUT_MS: Joi.number().integer().min(100).default(30000),
  TYPEORM_LOGGING: Joi.boolean().default(false),

  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  REDIS_KEY_PREFIX: Joi.string().default('taxikiwi:'),
  BULLMQ_PREFIX: Joi.string().default('taxikiwi'),
  BULLMQ_DEFAULT_JOB_ATTEMPTS: Joi.number().integer().min(1).default(3),
  BULLMQ_DEFAULT_BACKOFF_MS: Joi.number().integer().min(0).default(5000),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  COOKIE_SECRET: Joi.string().min(32).required(),
  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('strict'),

  ARGON2_MEMORY_COST: Joi.number().integer().min(8192).default(19456),
  ARGON2_TIME_COST: Joi.number().integer().min(1).default(2),
  ARGON2_PARALLELISM: Joi.number().integer().min(1).default(1),

  SWAGGER_ENABLED: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default('api/docs'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),

  SMTP_HOST: Joi.string().hostname().default('localhost'),
  SMTP_PORT: Joi.number().port().default(1025),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  MAIL_FROM_ADDRESS: Joi.string()
    .email({ tlds: { allow: false } })
    .default('no-reply@taxikiwi.local'),
  MAIL_FROM_NAME: Joi.string().default('TaxiKiwi'),
  INVITATION_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001/accept-invite'),
  RESET_PASSWORD_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001/reset-password'),
}).unknown(true);
