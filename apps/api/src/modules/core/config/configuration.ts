export type AppConfig = ReturnType<typeof configuration>;

export const configuration = () => {
  const adminOrigin =
    process.env.ADMIN_ORIGIN ?? process.env.CORS_ORIGIN ?? 'http://localhost:3001';
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);

  return {
    env: process.env.NODE_ENV ?? 'development',
    appEnv: process.env.APP_ENV ?? 'local',
    host: process.env.API_HOST ?? '0.0.0.0',
    port,
    adminOrigin,
    corsOrigins: parseCsv(process.env.CORS_ORIGIN ?? adminOrigin),
    database: {
      url: process.env.DATABASE_URL,
      poolMin: Number(process.env.DB_POOL_MIN ?? 2),
      poolMax: Number(process.env.DB_POOL_MAX ?? 10),
      connectionTimeoutMs: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5000),
      queryTimeoutMs: Number(process.env.DB_QUERY_TIMEOUT_MS ?? 30000),
      ssl: process.env.DATABASE_SSL === 'true',
      sslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
      logging: process.env.TYPEORM_LOGGING === 'true',
    },
    redis: {
      url: process.env.REDIS_URL,
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'taxikiwi:',
      bullPrefix: process.env.BULLMQ_PREFIX ?? 'taxikiwi',
    },
    queue: {
      defaultJobAttempts: Number(process.env.BULLMQ_DEFAULT_JOB_ATTEMPTS ?? 3),
      defaultBackoffMs: Number(process.env.BULLMQ_DEFAULT_BACKOFF_MS ?? 5000),
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    },
    argon: {
      memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456),
      timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
      parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
    },
    cookie: {
      secret: process.env.COOKIE_SECRET,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAME_SITE ?? 'strict',
    },
    log: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    swagger: {
      enabled: process.env.SWAGGER_ENABLED !== 'false',
      path: process.env.SWAGGER_PATH ?? 'api/docs',
    },
    throttling: {
      ttlMs: Number(process.env.THROTTLE_TTL_MS ?? 60000),
      limit: Number(process.env.THROTTLE_LIMIT ?? 10000), // Augmenté pour le développement
    },
    mail: {
      smtpHost: process.env.SMTP_HOST ?? 'localhost',
      smtpPort: Number(process.env.SMTP_PORT ?? 1025),
      smtpSecure: process.env.SMTP_SECURE === 'true',
      smtpUser: process.env.SMTP_USER || undefined,
      smtpPassword: process.env.SMTP_PASSWORD || undefined,
      fromAddress: process.env.MAIL_FROM_ADDRESS ?? 'no-reply@taxikiwi.local',
      fromName: process.env.MAIL_FROM_NAME ?? 'TaxiKiwi',
      invitationBaseUrl: process.env.INVITATION_BASE_URL ?? `${adminOrigin}/accept-invite`,
      resetPasswordBaseUrl: process.env.RESET_PASSWORD_BASE_URL ?? `${adminOrigin}/reset-password`,
    },
  };
};

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
