/**
 * Rate limiting.
 *
 * express-rate-limit with an in-memory store. Windows are fixed at 15
 * minutes. Limits are configurable per environment; the public register and
 * admin login routes are the two that matter, because they are the ones
 * worth attacking.
 */
import rateLimit from 'express-rate-limit';
import config from '../config/env.js';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

const WINDOW_MINUTES = 15;

const handler = (message) => (req, res) => {
  logger.warn({ ip: req.ip, path: req.originalUrl }, 'rate limit hit');
  res.setHeader('RateLimit-Limit', String(req.rateLimit?.limit ?? ''));
  return sendError(res, message, 429);
};

const base = {
  windowMs: WINDOW_MINUTES * 60 * 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

/** POST /api/register */
export const registerLimiter = rateLimit({
  ...base,
  limit: config.RATE_LIMIT_REGISTER_MAX,
  handler: handler('Too many registration attempts. Please try again in a few minutes.'),
});

/** POST /api/admin/login */
export const loginLimiter = rateLimit({
  ...base,
  // Count only failed attempts so a legitimate admin is never locked out by
  // an attacker hammering the endpoint from the same shared IP.
  skipSuccessfulRequests: true,
  limit: config.RATE_LIMIT_LOGIN_MAX,
  handler: handler('Too many failed login attempts. Please try again in a few minutes.'),
});

/** Everything else. */
export const generalLimiter = rateLimit({
  ...base,
  limit: config.RATE_LIMIT_GENERAL_MAX,
  handler: handler('Too many requests. Please slow down.'),
});

/** POST /api/contact */
export const contactLimiter = rateLimit({
  ...base,
  limit: 5,
  handler: handler('Too many messages sent. Please try again later.'),
});

export { WINDOW_MINUTES };

export default { registerLimiter, loginLimiter, generalLimiter, contactLimiter };
