/**
 * Authentication.
 *
 * Administrators authenticate with Supabase Auth (email + password).
 * There is no custom JWT, no bcrypt, no second token system.
 *
 * Flow
 *   POST /api/admin/login  -> supabase.auth.signInWithPassword -> access_token
 *   every admin request    -> Authorization: Bearer <access_token>
 *                            -> supabase.auth.getUser(token)  (validates it)
 *                            -> SELECT * FROM public.admins WHERE id = auth uid
 *
 * A valid Supabase session is not enough: the user must also have a row in
 * public.admins. That is what makes a non-admin "rejected" rather than
 * merely unauthenticated.
 */
import { getSupabaseAdmin } from '../db/supabase.js';
import { one } from '../db/pool.js';
import config from '../config/env.js';
import AppError from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Verify a Supabase access token and load the linked admin row.
 * @param {string} token
 * @returns {Promise<{ id: string, email: string, name: string, role: string }>}
 */
export async function verifyAdminToken(token) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    logger.info({ reason: error?.message ?? 'no user' }, 'rejected admin token');
    throw AppError.unauthorized('Session invalid or expired.');
  }

  const authUser = data.user;
  const admin = await one(
    'select id, email, name, role from public.admins where id = $1',
    [authUser.id]
  );

  if (!admin) {
    logger.warn({ userId: authUser.id }, 'authenticated user is not an administrator');
    throw AppError.forbidden('This account is not an administrator.');
  }

  // Optional extra allowlist. Empty by default.
  if (config.ADMIN_EMAILS.length > 0) {
    const allowed = config.ADMIN_EMAILS.map((value) => value.toLowerCase());
    if (!allowed.includes(String(admin.email).toLowerCase())) {
      logger.warn({ email: admin.email }, 'administrator is not in ADMIN_EMAILS');
      throw AppError.forbidden('This account is not allowed to sign in.');
    }
  }

  return admin;
}

function readBearerToken(req) {
  const header = req.headers.authorization ?? req.headers.Authorization ?? '';
  if (typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Require a valid administrator session.
 * On success sets `req.admin = { id, email, name, role }`.
 */
export async function requireAdmin(req, res, next) {
  try {
    const token = readBearerToken(req);

    if (!token) {
      throw AppError.unauthorized('No token provided.');
    }

    req.admin = await verifyAdminToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Restrict a route to a specific role.
 * @param {...('super'|'admin')} roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return next(AppError.unauthorized('No token provided.'));
    }
    if (!roles.includes(req.admin.role)) {
      return next(AppError.forbidden('Insufficient permissions.'));
    }
    return next();
  };
}

/** Record a successful sign-in. Never blocks the request. */
export async function touchLastLogin(adminId) {
  try {
    await one('update public.admins set last_login = now() where id = $1 returning id', [adminId]);
  } catch (error) {
    logger.warn({ err: error, adminId }, 'could not update last_login');
  }
}

export default { requireAdmin, requireRole, verifyAdminToken, touchLastLogin };
