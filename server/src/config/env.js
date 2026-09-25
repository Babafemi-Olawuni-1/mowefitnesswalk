/**
 * Environment configuration.
 *
 * Everything the server needs is parsed and validated exactly once, at
 * import time, so a misconfigured deployment fails immediately and loudly
 * instead of at the first request.
 *
 * Nothing in here is ever exposed to the browser.
 */
import 'dotenv/config';
import { z } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

const booleanish = (fallback) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return fallback;
      return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
    });

const csvList = (fallback) =>
  z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .length
        ? (value ?? '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        : fallback
    );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Supabase connection string)'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  APP_URL: z.string().url('APP_URL must be a valid URL'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  QR_BASE_URL: z.string().min(1, 'QR_BASE_URL is required and must contain {id}'),

  PARTICIPANT_PREFIX: z.string().min(2).max(20).default('MIWC2026'),
  MAX_UPLOAD_SIZE: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  ALLOWED_IMAGE_TYPES: csvList(['image/jpeg', 'image/png', 'image/webp']),

  APP_TIMEZONE: z.string().default('Africa/Lagos'),
  ADMIN_EMAILS: csvList([]),

  MAIL_PROVIDER: z.enum(['smtp', 'resend', 'log']).default('log'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanish(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('Mowe-Ibafo X Community'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(8),
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().positive().default(300),

  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  AUTH_STRICT: booleanish(true),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n[config] Invalid environment configuration:\n${details}\n`);
  throw new Error('Invalid environment configuration');
}

const raw = parsed.data;

if (!raw.QR_BASE_URL.includes('{id}')) {
  // eslint-disable-next-line no-console
  console.error('[config] QR_BASE_URL must contain the literal token {id}');
  throw new Error('Invalid environment configuration');
}

if (raw.MAIL_PROVIDER === 'smtp' && !(raw.SMTP_HOST && raw.SMTP_FROM)) {
  // eslint-disable-next-line no-console
  console.error('[config] MAIL_PROVIDER=smtp requires SMTP_HOST and SMTP_FROM');
  throw new Error('Invalid environment configuration');
}

if (raw.MAIL_PROVIDER === 'resend' && !raw.RESEND_API_KEY) {
  // eslint-disable-next-line no-console
  console.error('[config] MAIL_PROVIDER=resend requires RESEND_API_KEY');
  throw new Error('Invalid environment configuration');
}

const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

export const config = Object.freeze({
  ...raw,
  isProduction,
  APP_URL: stripTrailingSlash(raw.APP_URL),
  FRONTEND_URL: stripTrailingSlash(raw.FRONTEND_URL),
  PARTICIPANT_PREFIX: raw.PARTICIPANT_PREFIX.toUpperCase(),
  PAGE_SIZE: 20,
});

/** Origins allowed to call this API from a browser. */
export const allowedOrigins = () =>
  [
    config.FRONTEND_URL,
    config.APP_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

export default config;
