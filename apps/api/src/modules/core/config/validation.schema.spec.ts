import { validationSchema } from './validation.schema';

const validEnvironment = {
  COOKIE_SECRET: 'dev-only-change-me-cookie-secret-32chars',
  DATABASE_URL: 'postgresql://taxikiwi:taxikiwi_dev_password@localhost:5432/taxikiwi',
  JWT_ACCESS_SECRET: 'dev-only-change-me-access-secret-32chars',
  JWT_REFRESH_SECRET: 'dev-only-change-me-refresh-secret-32chars',
  REDIS_URL: 'redis://localhost:6379/0',
};

/**
 * Type pour les valeurs validées retournées par le schéma Joi.
 * Nécessaire pour éviter les erreurs ESLint `no-unsafe-member-access`
 * sur le type `any` retourné par `Joi.validate()`.
 */
interface ValidatedEnv {
  COOKIE_SAME_SITE: string;
  COOKIE_SECRET: string;
  DATABASE_URL: string;
  DB_POOL_MAX: number;
  DB_POOL_MIN: number;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  LOG_LEVEL: string;
  NODE_ENV: string;
  PORT: number;
  REDIS_URL: string;
  SWAGGER_ENABLED: boolean;
  THROTTLE_LIMIT: number;
  THROTTLE_TTL_MS: number;
}

describe('Core validation schema', () => {
  it('accepts the minimal required environment', () => {
    const { error } = validationSchema.validate(validEnvironment);

    expect(error).toBeUndefined();
  });

  // ── JWT secrets ──────────────────────────────────────────

  it('rejects a missing JWT access secret', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      JWT_ACCESS_SECRET: undefined,
    });

    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('rejects a short JWT access secret (< 32 chars)', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      JWT_ACCESS_SECRET: 'too-short',
    });

    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('rejects a missing JWT refresh secret', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      JWT_REFRESH_SECRET: undefined,
    });

    expect(error?.message).toContain('JWT_REFRESH_SECRET');
  });

  it('rejects a short JWT refresh secret (< 32 chars)', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      JWT_REFRESH_SECRET: 'short',
    });

    expect(error?.message).toContain('JWT_REFRESH_SECRET');
  });

  // ── Database ─────────────────────────────────────────────

  it('rejects a missing DATABASE_URL', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      DATABASE_URL: undefined,
    });

    expect(error?.message).toContain('DATABASE_URL');
  });

  it('rejects an invalid DATABASE_URL scheme', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      DATABASE_URL: 'mysql://localhost:3306/taxikiwi',
    });

    expect(error?.message).toContain('DATABASE_URL');
  });

  // ── Redis ────────────────────────────────────────────────

  it('rejects a missing REDIS_URL', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      REDIS_URL: undefined,
    });

    expect(error?.message).toContain('REDIS_URL');
  });

  it('rejects an invalid REDIS_URL scheme', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      REDIS_URL: 'http://localhost:6379',
    });

    expect(error?.message).toContain('REDIS_URL');
  });

  // ── Cookie ───────────────────────────────────────────────

  it('rejects a missing COOKIE_SECRET', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      COOKIE_SECRET: undefined,
    });

    expect(error?.message).toContain('COOKIE_SECRET');
  });

  it('rejects a short COOKIE_SECRET (< 32 chars)', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      COOKIE_SECRET: 'short-secret',
    });

    expect(error?.message).toContain('COOKIE_SECRET');
  });

  // ── NODE_ENV ─────────────────────────────────────────────

  it('rejects an invalid NODE_ENV value', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      NODE_ENV: 'staging',
    });

    expect(error?.message).toContain('NODE_ENV');
  });

  it('accepts valid NODE_ENV values', () => {
    for (const env of ['development', 'test', 'production']) {
      const { error } = validationSchema.validate({
        ...validEnvironment,
        NODE_ENV: env,
      });

      expect(error).toBeUndefined();
    }
  });

  // ── Defaults ─────────────────────────────────────────────

  it('applies sensible defaults when optional vars are omitted', () => {
    const result = validationSchema.validate(validEnvironment);
    const value = result.value as ValidatedEnv;

    expect(value.NODE_ENV).toBe('development');
    expect(value.LOG_LEVEL).toBe('info');
    expect(value.PORT).toBe(3000);
    expect(value.DB_POOL_MIN).toBe(2);
    expect(value.DB_POOL_MAX).toBe(10);
    expect(value.THROTTLE_TTL_MS).toBe(60000);
    expect(value.THROTTLE_LIMIT).toBe(100);
    expect(value.SWAGGER_ENABLED).toBe(true);
    expect(value.COOKIE_SAME_SITE).toBe('strict');
  });

  // ── Reports all errors at once ───────────────────────────

  it('reports multiple errors when multiple required vars are missing', () => {
    const { error } = validationSchema.validate({}, { abortEarly: false });

    expect(error).toBeDefined();
    expect(error?.details.length).toBeGreaterThanOrEqual(4);
  });
});
