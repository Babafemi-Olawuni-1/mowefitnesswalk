/**
 * Structured logging via pino.
 *
 * Logs are JSON lines in production (greppable by Render) and pretty in
 * development. Secrets are redacted defensively.
 */
import pino from 'pino';
import config from '../config/env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  '*.password',
  '*.service_role',
  '*.token',
  '*.access_token',
  '*.refresh_token',
];

const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'miwc-2026-api' },
  redact: { paths: redactPaths, censor: '[redacted]' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },
        },
      }),
});

export default logger;
